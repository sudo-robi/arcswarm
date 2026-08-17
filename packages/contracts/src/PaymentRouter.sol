// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PaymentRouter
/// @notice Routes USDC payments between ArcSwarm agents, including
///         nanopayments (x402) and batch disbursements.
/// @dev All external state-changing functions are protected by ReentrancyGuard
///      and follow the Checks-Effects-Interactions pattern.
contract PaymentRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // ── Errors ───────────────────────────────────────────────────────────
    error NotCoordinator();
    error NotAgent();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error ExceedsNanopaymentLimit();
    error LengthMismatch();
    error EmptyBatch();
    error ZeroAmountInBatch();
    error InsufficientBatchBalance();

    // ── Immutable storage ────────────────────────────────────────────────
    IERC20 public immutable usdc;

    // ── Types ────────────────────────────────────────────────────────────
    struct Payment {
        address from;
        address to;
        uint256 amount;
        string memo;
        uint256 timestamp;
        bool executed;
    }

    struct Nanopayment {
        address payer;
        address payee;
        uint256 amount;
        string serviceId;
        uint256 timestamp;
    }

    // ── Storage ──────────────────────────────────────────────────────────
    Payment[] public payments;
    Nanopayment[] public nanopayments;
    mapping(address => uint256) public agentPaymentCount;
    mapping(address => uint256) public agentTotalPaid;

    uint256 public totalPayments;
    uint256 public totalNanopayments;
    uint256 public nanopaymentLimit = 1e4; // 0.01 USDC (10,000 with 6 decimals)
    uint256 public immutable MAX_BATCH_SIZE = 50;

    error BatchTooLarge();

    // ── Events ───────────────────────────────────────────────────────────
    event PaymentExecuted(uint256 indexed paymentId, address from, address to, uint256 amount);
    event NanopaymentExecuted(uint256 indexed nanopaymentId, address payer, address payee, uint256 amount, string serviceId);
    event BatchPaymentExecuted(uint256 count, uint256 totalAmount);
    event NanopaymentLimitUpdated(uint256 newLimit);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyCoordinator() {
        if (!hasRole(COORDINATOR_ROLE, msg.sender)) revert NotCoordinator();
        _;
    }

    modifier onlyAgent() {
        if (!hasRole(AGENT_ROLE, msg.sender)) revert NotAgent();
        _;
    }

    /// @notice Deploy the router with a reference to the USDC token.
    /// @param _usdc Address of the USDC ERC-20 token.
    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    /// @notice Execute a single payment from the caller to a recipient.
    /// @dev Caller must have sufficient USDC balance and allowance.
    /// @param to     Recipient address.
    /// @param amount Amount of USDC (6-decimal).
    /// @param memo   Arbitrary memo string.
    /// @return paymentId Index of the newly created payment record.
    function executePayment(
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyAgent nonReentrant returns (uint256) {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (usdc.balanceOf(msg.sender) < amount) revert InsufficientBalance();

        // Effects
        uint256 paymentId = payments.length;
        payments.push(Payment({
            from: msg.sender,
            to: to,
            amount: amount,
            memo: memo,
            timestamp: block.timestamp,
            executed: true
        }));

        agentPaymentCount[msg.sender]++;
        agentTotalPaid[msg.sender] += amount;
        totalPayments++;

        // Interaction
        usdc.safeTransferFrom(msg.sender, to, amount);

        emit PaymentExecuted(paymentId, msg.sender, to, amount);
        return paymentId;
    }

    /// @notice Execute a nanopayment (x402) from the caller to a payee.
    /// @dev Amount must not exceed `nanopaymentLimit`.
    /// @param payee     Payee address.
    /// @param amount    Amount of USDC (6-decimal).
    /// @param serviceId Service identifier string.
    /// @return nanopaymentId Index of the newly created nanopayment record.
    function executeNanopayment(
        address payee,
        uint256 amount,
        string calldata serviceId
    ) external onlyAgent nonReentrant returns (uint256) {
        if (amount == 0) revert ZeroAmount();
        if (payee == address(0)) revert ZeroAddress();
        if (amount > nanopaymentLimit) revert ExceedsNanopaymentLimit();
        if (usdc.balanceOf(msg.sender) < amount) revert InsufficientBalance();

        // Effects
        uint256 nanopaymentId = nanopayments.length;
        nanopayments.push(Nanopayment({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            serviceId: serviceId,
            timestamp: block.timestamp
        }));

        agentPaymentCount[msg.sender]++;
        agentTotalPaid[msg.sender] += amount;
        totalNanopayments++;

        // Interaction
        usdc.safeTransferFrom(msg.sender, payee, amount);

        emit NanopaymentExecuted(nanopaymentId, msg.sender, payee, amount, serviceId);
        return nanopaymentId;
    }

    /// @notice Execute a batch of payments from the coordinator.
    /// @dev All arrays must have the same length. Total amount must not exceed
    ///      the coordinator's USDC balance.
    /// @param recipients Array of recipient addresses.
    /// @param amounts    Array of USDC amounts (6-decimal).
    /// @param memos      Array of memo strings.
    /// @return count Number of payments executed.
    function executeBatchPayments(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string[] calldata memos
    ) external onlyCoordinator nonReentrant returns (uint256) {
        if (recipients.length != amounts.length || recipients.length != memos.length)
            revert LengthMismatch();
        if (recipients.length == 0) revert EmptyBatch();
        if (recipients.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (amounts[i] == 0) revert ZeroAmountInBatch();
            if (recipients[i] == address(0)) revert ZeroAddress();
            totalAmount += amounts[i];
        }

        if (usdc.balanceOf(msg.sender) < totalAmount) revert InsufficientBatchBalance();

        // Effects
        uint256 basePaymentId = payments.length;
        for (uint256 i = 0; i < recipients.length; i++) {
            payments.push(Payment({
                from: msg.sender,
                to: recipients[i],
                amount: amounts[i],
                memo: memos[i],
                timestamp: block.timestamp,
                executed: true
            }));
            totalPayments++;
        }

        agentPaymentCount[msg.sender] += recipients.length;
        agentTotalPaid[msg.sender] += totalAmount;

        // Interactions
        for (uint256 i = 0; i < recipients.length; i++) {
            usdc.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }

        emit BatchPaymentExecuted(recipients.length, totalAmount);
        return recipients.length;
    }

    /// @notice Update the maximum nanopayment amount.
    /// @param _limit New limit in USDC (6-decimal).
    function setNanopaymentLimit(uint256 _limit) external onlyCoordinator {
        nanopaymentLimit = _limit;
        emit NanopaymentLimitUpdated(_limit);
    }

    // ── View functions ───────────────────────────────────────────────────

    /// @notice Retrieve a payment record by index.
    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    /// @notice Retrieve a nanopayment record by index.
    function getNanopayment(uint256 nanopaymentId) external view returns (Nanopayment memory) {
        return nanopayments[nanopaymentId];
    }

    /// @notice Total number of payments executed.
    function getPaymentCount() external view returns (uint256) {
        return payments.length;
    }

    /// @notice Total number of nanopayments executed.
    function getNanopaymentCount() external view returns (uint256) {
        return nanopayments.length;
    }

    /// @notice Number of payments made by an agent.
    function getAgentPayments(address agent) external view returns (uint256) {
        return agentPaymentCount[agent];
    }

    /// @notice Total USDC paid by an agent.
    function getAgentTotalPaid(address agent) external view returns (uint256) {
        return agentTotalPaid[agent];
    }
}
