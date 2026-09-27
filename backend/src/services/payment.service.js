// =====================================================================
// Simulated payment processing.
//
// No real payment gateway (per the assignment - "Cash or simulated
// TeslaPay wallet"). Two methods:
//   CASH     - assumed handed to the driver in person; marked PAID the
//              instant the trip completes, no balance check needed.
//   TESLAPAY - deducted from the passenger's in-app wallet balance.
//              If the wallet doesn't have enough, payment is marked
//              FAILED - but the ride itself still completes. We made
//              this assumption deliberately: in the real world a driver
//              has already driven the trip by COMPLETED, so blocking
//              trip completion on a failed charge would strand the
//              driver. A FAILED payment is instead something to chase
//              up afterwards (see README "Design decisions").
// =====================================================================

class InsufficientWalletBalanceError extends Error {
  constructor(message = 'Wallet balance is insufficient for this fare') {
    super(message);
    this.name = 'InsufficientWalletBalanceError';
    this.statusCode = 402;
  }
}

/**
 * Settles payment for one ride request as part of an existing Prisma
 * transaction (tx). Must be called with the same `tx` used to move the
 * ride to COMPLETED, so wallet debit and status change are atomic.
 */
async function settlePayment(tx, { rideRequestId, passengerId, method, farePaisa }) {
  if (method === 'CASH') {
    return tx.rideRequest.update({
      where: { id: rideRequestId },
      data: { paymentStatus: 'PAID', paidAt: new Date() },
    });
  }

  // TESLAPAY: row-lock the user so two simultaneous debits on the same
  // wallet can't race each other, same pattern as seat allocation.
  const rows = await tx.$queryRaw`
    SELECT id, "walletBalancePaisa" FROM users WHERE id = ${passengerId} FOR UPDATE
  `;
  const user = rows[0];

  if (!user || user.walletBalancePaisa < farePaisa) {
    await tx.rideRequest.update({
      where: { id: rideRequestId },
      data: { paymentStatus: 'FAILED' },
    });
    return null;
  }

  await tx.user.update({
    where: { id: passengerId },
    data: { walletBalancePaisa: { decrement: farePaisa } },
  });

  return tx.rideRequest.update({
    where: { id: rideRequestId },
    data: { paymentStatus: 'PAID', paidAt: new Date() },
  });
}

module.exports = { settlePayment, InsufficientWalletBalanceError };
