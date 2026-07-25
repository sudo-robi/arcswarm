// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PaymentRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    IERC20 public immutable usdc;

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

    Payment[] public payments;
    Nanopayment[] public nanopayments;
    mapping(address => uint256) public agentPaymentCount;
    mapping(address => uint256) public agentTotalPaid;

    uint256 public totalPayments;
    uint256 public totalNanopayments;
    uint256 public nanopaymentLimit = 1e4; // 0.01 USDC (10,000 with 6 decimals)

    event PaymentExecuted(uint256 indexed paymentId, address from, address to, uint256 amount);
    event NanopaymentExecuted(uint256 indexed nanopaymentId, address payer, address payee, uint256 amount, string serviceId);
    event BatchPaymentExecuted(uint256 count, uint256 totalAmount);
    event NanopaymentLimitUpdated(uint256 newLimit);

    modifier onlyCoordinator() {
        require(hasRole(COORDINATOR_ROLE, msg.sender), "Not coordinator");
        _;
    }

    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "Not agent");
        _;
    }

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    function executePayment(
        address to,
        uint256 amount,
        string calldata memo
    ) external onlyAgent nonReentrant returns (uint256) {
        require(amount > 0, "Zero amount");
        require(usdc.balanceOf(msg.sender) >= amount, "Insufficient balance");

        usdc.safeTransferFrom(msg.sender, to, amount);

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

        emit PaymentExecuted(paymentId, msg.sender, to, amount);
        return paymentId;
    }

    function executeNanopayment(
        address payee,
        uint256 amount,
        string calldata serviceId
    ) external onlyAgent nonReentrant returns (uint256) {
        require(amount > 0, "Zero amount");
        require(amount <= nanopaymentLimit, "Exceeds nanopayment limit");
        require(usdc.balanceOf(msg.sender) >= amount, "Insufficient balance");

        usdc.safeTransferFrom(msg.sender, payee, amount);

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

        emit NanopaymentExecuted(nanopaymentId, msg.sender, payee, amount, serviceId);
        return nanopaymentId;
    }

    function executeBatchPayments(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string[] calldata memos
    ) external onlyCoordinator nonReentrant returns (uint256) {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length == memos.length, "Length mismatch");
        require(recipients.length > 0, "Empty batch");

        uint256 totalAmount;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(amounts[i] > 0, "Zero amount in batch");
            totalAmount += amounts[i];
        }

        require(usdc.balanceOf(msg.sender) >= totalAmount, "Insufficient batch balance");

        for (uint256 i = 0; i < recipients.length; i++) {
            usdc.safeTransferFrom(msg.sender, recipients[i], amounts[i]);

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

        emit BatchPaymentExecuted(recipients.length, totalAmount);
        return recipients.length;
    }

    function setNanopaymentLimit(uint256 _limit) external onlyCoordinator {
        nanopaymentLimit = _limit;
        emit NanopaymentLimitUpdated(_limit);
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    function getNanopayment(uint256 nanopaymentId) external view returns (Nanopayment memory) {
        return nanopayments[nanopaymentId];
    }

    function getPaymentCount() external view returns (uint256) {
        return payments.length;
    }

    function getNanopaymentCount() external view returns (uint256) {
        return nanopayments.length;
    }

    function getAgentPayments(address agent) external view returns (uint256) {
        return agentPaymentCount[agent];
    }

    function getAgentTotalPaid(address agent) external view returns (uint256) {
        return agentTotalPaid[agent];
    }
}
