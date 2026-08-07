// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/PaymentRouter.sol";

contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract PaymentRouterTest is Test {
    MockUSDC usdc;
    PaymentRouter router;

    address yieldAgent = makeAddr("yieldAgent");
    address riskAgent = makeAddr("riskAgent");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant AGENT_ROLE = keccak256("AGENT_ROLE");

    function setUp() public {
        usdc = new MockUSDC();
        router = new PaymentRouter(address(usdc));

        // admin = address(this) is granted COORDINATOR_ROLE by the constructor.
        router.grantRole(AGENT_ROLE, yieldAgent);
        router.grantRole(AGENT_ROLE, riskAgent);

        usdc.mint(yieldAgent, 100_000e6);
        usdc.mint(admin(), 100_000e6);
    }

    function admin() internal view returns (address) {
        return address(this);
    }

    // ---------- executePayment (the "pay" path) ----------

    function testExecutePayment_OnlyAgentReverts() public {
        vm.startPrank(alice);
        usdc.mint(alice, 10_000e6);
        usdc.approve(address(router), 10_000e6);

        vm.expectRevert("Not agent");
        router.executePayment(riskAgent, 1_000e6, "memo");
        vm.stopPrank();
    }

    function testExecutePayment_ZeroAmountReverts() public {
        vm.prank(yieldAgent);
        vm.expectRevert("Zero amount");
        router.executePayment(riskAgent, 0, "memo");
    }

    function testExecutePayment_InsufficientBalanceReverts() public {
        // Agent with no USDC.
        vm.prank(riskAgent);
        vm.expectRevert("Insufficient balance");
        router.executePayment(yieldAgent, 1e6, "memo");
    }

    function testExecutePayment_Success() public {
        vm.startPrank(yieldAgent);
        usdc.approve(address(router), 10_000e6);

        vm.expectEmit(true, true, true, true);
        emit PaymentRouter.PaymentExecuted(0, yieldAgent, riskAgent, 5_000e6);
        uint256 paymentId = router.executePayment(riskAgent, 5_000e6, "settlement");
        vm.stopPrank();

        assertEq(paymentId, 0);
        assertEq(router.getPaymentCount(), 1);
        assertEq(router.totalPayments(), 1);

        PaymentRouter.Payment memory p = router.getPayment(0);
        assertEq(p.from, yieldAgent);
        assertEq(p.to, riskAgent);
        assertEq(p.amount, 5_000e6);
        assertEq(p.memo, "settlement");
        assertEq(p.timestamp, block.timestamp);
        assertTrue(p.executed);

        assertEq(usdc.balanceOf(riskAgent), 5_000e6);
        assertEq(usdc.balanceOf(yieldAgent), 95_000e6);
        assertEq(router.agentPaymentCount(yieldAgent), 1);
        assertEq(router.agentTotalPaid(yieldAgent), 5_000e6);
        assertEq(router.getAgentPayments(yieldAgent), 1);
        assertEq(router.getAgentTotalPaid(yieldAgent), 5_000e6);
    }

    function testExecutePayment_MultiplePayments() public {
        vm.startPrank(yieldAgent);
        usdc.approve(address(router), 20_000e6);
        router.executePayment(riskAgent, 1_000e6, "first");
        uint256 second = router.executePayment(alice, 2_000e6, "second");
        uint256 third = router.executePayment(bob, 3_000e6, "third");
        vm.stopPrank();

        assertEq(second, 1);
        assertEq(third, 2);
        assertEq(router.getPaymentCount(), 3);
        assertEq(usdc.balanceOf(riskAgent), 1_000e6);
        assertEq(usdc.balanceOf(alice), 2_000e6);
        assertEq(usdc.balanceOf(bob), 3_000e6);
    }

    // ---------- executeNanopayment (the "nanopay" path) ----------

    function testNanopayment_UnderLimitSuccess() public {
        vm.startPrank(yieldAgent);
        usdc.approve(address(router), 10_000e6);

        vm.expectEmit(true, true, true, true);
        emit PaymentRouter.NanopaymentExecuted(0, yieldAgent, riskAgent, 1000, "risk-check");
        uint256 nanoId = router.executeNanopayment(riskAgent, 1000, "risk-check");
        vm.stopPrank();

        assertEq(nanoId, 0);
        assertEq(router.getNanopaymentCount(), 1);
        assertEq(router.totalNanopayments(), 1);

        PaymentRouter.Nanopayment memory n = router.getNanopayment(0);
        assertEq(n.payer, yieldAgent);
        assertEq(n.payee, riskAgent);
        assertEq(n.amount, 1000);
        assertEq(n.serviceId, "risk-check");
        assertEq(n.timestamp, block.timestamp);

        assertEq(usdc.balanceOf(riskAgent), 1000);
        assertEq(router.agentTotalPaid(yieldAgent), 1000);
    }

    function testNanopayment_ExactlyAtLimitSucceeds() public {
        vm.startPrank(yieldAgent);
        usdc.approve(address(router), 10_000e6);
        router.executeNanopayment(riskAgent, router.nanopaymentLimit(), "exact-limit");
        vm.stopPrank();

        assertEq(usdc.balanceOf(riskAgent), router.nanopaymentLimit());
        assertEq(router.getNanopaymentCount(), 1);
    }

    function testNanopayment_OverLimitReverts() public {
        uint256 limit = router.nanopaymentLimit();

        vm.startPrank(yieldAgent);
        usdc.approve(address(router), 10_000e6);

        vm.expectRevert("Exceeds nanopayment limit");
        router.executeNanopayment(riskAgent, limit + 1, "too-big");
        vm.stopPrank();
    }

    function testNanopayment_ZeroAmountReverts() public {
        vm.prank(yieldAgent);
        vm.expectRevert("Zero amount");
        router.executeNanopayment(riskAgent, 0, "zero");
    }

    function testNanopayment_InsufficientBalanceReverts() public {
        vm.prank(riskAgent);
        vm.expectRevert("Insufficient balance");
        router.executeNanopayment(yieldAgent, 1000, "no-funds");
    }

    function testNanopayment_OnlyAgentReverts() public {
        vm.startPrank(alice);
        usdc.mint(alice, 10_000e6);
        usdc.approve(address(router), 10_000e6);

        vm.expectRevert("Not agent");
        router.executeNanopayment(riskAgent, 1000, "not-agent");
        vm.stopPrank();
    }

    // ---------- executeBatchPayments ----------

    function testBatchPayments_AmountLengthMismatchReverts() public {
        address[] memory recipients = new address[](2);
        recipients[0] = riskAgent;
        recipients[1] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000e6;
        string[] memory memos = new string[](2);

        vm.expectRevert("Length mismatch");
        router.executeBatchPayments(recipients, amounts, memos);
    }

    function testBatchPayments_MemoLengthMismatchReverts() public {
        address[] memory recipients = new address[](2);
        recipients[0] = riskAgent;
        recipients[1] = alice;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1_000e6;
        amounts[1] = 2_000e6;
        string[] memory memos = new string[](1);

        vm.expectRevert("Length mismatch");
        router.executeBatchPayments(recipients, amounts, memos);
    }

    function testBatchPayments_EmptyBatchReverts() public {
        address[] memory recipients = new address[](0);
        uint256[] memory amounts = new uint256[](0);
        string[] memory memos = new string[](0);

        vm.expectRevert("Empty batch");
        router.executeBatchPayments(recipients, amounts, memos);
    }

    function testBatchPayments_ZeroAmountReverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = riskAgent;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0;
        string[] memory memos = new string[](1);
        memos[0] = "zero";

        vm.expectRevert("Zero amount in batch");
        router.executeBatchPayments(recipients, amounts, memos);
    }

    function testBatchPayments_InsufficientBalanceReverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = riskAgent;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000e6;
        string[] memory memos = new string[](1);
        memos[0] = "too-much";

        vm.expectRevert("Insufficient batch balance");
        router.executeBatchPayments(recipients, amounts, memos);
    }

    function testBatchPayments_Success() public {
        address[] memory recipients = new address[](3);
        recipients[0] = riskAgent;
        recipients[1] = alice;
        recipients[2] = bob;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1_000e6;
        amounts[1] = 2_000e6;
        amounts[2] = 3_000e6;
        string[] memory memos = new string[](3);
        memos[0] = "yield allocation";
        memos[1] = "risk allocation";
        memos[2] = "user refund";

        usdc.approve(address(router), 10_000e6);

        vm.expectEmit(true, true, true, true);
        emit PaymentRouter.BatchPaymentExecuted(3, 6_000e6);
        uint256 count = router.executeBatchPayments(recipients, amounts, memos);

        assertEq(count, 3);
        assertEq(router.getPaymentCount(), 3);
        assertEq(router.totalPayments(), 3);
        assertEq(usdc.balanceOf(riskAgent), 1_000e6);
        assertEq(usdc.balanceOf(alice), 2_000e6);
        assertEq(usdc.balanceOf(bob), 3_000e6);
        assertEq(router.agentPaymentCount(admin()), 3);
        assertEq(router.agentTotalPaid(admin()), 6_000e6);

        PaymentRouter.Payment memory p = router.getPayment(1);
        assertEq(p.to, alice);
        assertEq(p.amount, 2_000e6);
        assertEq(p.memo, "risk allocation");
    }

    function testBatchPayments_OnlyCoordinatorReverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = riskAgent;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000e6;
        string[] memory memos = new string[](1);
        memos[0] = "memo";

        vm.prank(yieldAgent);
        vm.expectRevert("Not coordinator");
        router.executeBatchPayments(recipients, amounts, memos);
    }

    // ---------- nanopayment limit management ----------

    function testSetNanopaymentLimit_OnlyCoordinator() public {
        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        router.setNanopaymentLimit(5e4);
    }

    function testSetNanopaymentLimit_Success() public {
        vm.expectEmit(true, true, true, true);
        emit PaymentRouter.NanopaymentLimitUpdated(5e4);
        router.setNanopaymentLimit(5e4);

        assertEq(router.nanopaymentLimit(), 5e4);
    }

    function testSetNanopaymentLimit_Enforced() public {
        router.setNanopaymentLimit(500);

        vm.startPrank(yieldAgent);
        usdc.approve(address(router), 10_000e6);

        vm.expectRevert("Exceeds nanopayment limit");
        router.executeNanopayment(riskAgent, 501, "over-new-limit");

        router.executeNanopayment(riskAgent, 500, "at-new-limit");
        vm.stopPrank();

        assertEq(router.getNanopaymentCount(), 1);
        assertEq(usdc.balanceOf(riskAgent), 500);
    }
}
