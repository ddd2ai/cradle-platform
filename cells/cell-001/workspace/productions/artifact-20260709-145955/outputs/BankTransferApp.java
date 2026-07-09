import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

public class BankTransferApp {

    // Account
    static class Account {
        private final String id;
        private final String name;
        private BigDecimal balance;

        public Account(String id, String name, BigDecimal initialBalance) {
            this.id = id;
            this.name = name;
            this.balance = initialBalance.setScale(2, RoundingMode.HALF_EVEN);
        }

        public String getId() { return id; }
        public String getName() { return name; }

        public synchronized BigDecimal getBalance() { return balance; }

        // debit: subtract amount (assumes caller checks funds)
        public synchronized void debit(BigDecimal amount) {
            balance = balance.subtract(amount).setScale(2, RoundingMode.HALF_EVEN);
        }

        // credit: add amount
        public synchronized void credit(BigDecimal amount) {
            balance = balance.add(amount).setScale(2, RoundingMode.HALF_EVEN);
        }

        @Override
        public String toString() {
            return name + " (" + id + "): " + balance.setScale(2, RoundingMode.HALF_EVEN).toPlainString();
        }
    }

    // TransferRequest
    static class TransferRequest {
        final String fromAccountId;
        final String toAccountId;
        final BigDecimal amount;

        public TransferRequest(String fromAccountId, String toAccountId, BigDecimal amount) {
            this.fromAccountId = fromAccountId;
            this.toAccountId = toAccountId;
            this.amount = amount.setScale(2, RoundingMode.HALF_EVEN);
        }
    }

    // TransferResult
    static class TransferResult {
        final boolean accepted;
        final String message;
        final BigDecimal fee;
        final TransferRequest request;

        public TransferResult(boolean accepted, String message, BigDecimal fee, TransferRequest request) {
            this.accepted = accepted;
            this.message = message;
            this.fee = fee.setScale(2, RoundingMode.HALF_EVEN);
            this.request = request;
        }

        @Override
        public String toString() {
            return "Transfer from " + request.fromAccountId + " to " + request.toAccountId + " amount " + request.amount.toPlainString() + ": " + message;
        }
    }

    // LedgerEntry
    static class LedgerEntry {
        enum Type { DEBIT, CREDIT, FEE }
        private static final AtomicLong ID_GEN = new AtomicLong(1);

        final long id;
        final Type type;
        final String accountId;
        final BigDecimal amount;
        final String description;
        final LocalDateTime timestamp;

        public LedgerEntry(Type type, String accountId, BigDecimal amount, String description) {
            this.id = ID_GEN.getAndIncrement();
            this.type = type;
            this.accountId = accountId;
            this.amount = amount.setScale(2, RoundingMode.HALF_EVEN);
            this.description = description;
            this.timestamp = LocalDateTime.now();
        }

        @Override
        public String toString() {
            return "#" + id + " [" + type + "] account=" + accountId + " amount=" + amount.toPlainString() + " desc=" + description + " at=" + timestamp;
        }
    }

    // LedgerService
    static class LedgerService {
        private final List<LedgerEntry> entries = new ArrayList<>();

        public synchronized void addEntry(LedgerEntry entry) {
            entries.add(entry);
        }

        public synchronized List<LedgerEntry> getEntries() {
            return new ArrayList<>(entries);
        }

        public synchronized BigDecimal totalFees() {
            BigDecimal sum = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN);
            for (LedgerEntry e : entries) {
                if (e.type == LedgerEntry.Type.FEE) {
                    sum = sum.add(e.amount);
                }
            }
            return sum;
        }
    }

    // BankService
    static class BankService {
        private final Map<String, Account> accounts = new HashMap<>();
        private final LedgerService ledger;
        private final BigDecimal feePerTransfer;

        public BankService(LedgerService ledger, BigDecimal feePerTransfer) {
            this.ledger = ledger;
            this.feePerTransfer = feePerTransfer.setScale(2, RoundingMode.HALF_EVEN);
        }

        public void addAccount(Account acc) {
            accounts.put(acc.getId(), acc);
        }

        public Account getAccount(String id) {
            return accounts.get(id);
        }

        public TransferResult transfer(TransferRequest req) {
            Account from = accounts.get(req.fromAccountId);
            Account to = accounts.get(req.toAccountId);
            if (from == null || to == null) {
                return new TransferResult(false, "transfer rejected (account not found)", BigDecimal.ZERO, req);
            }

            BigDecimal required = req.amount.add(feePerTransfer).setScale(2, RoundingMode.HALF_EVEN);

            synchronized (from) { // ensure atomic check+debit on sender
                if (from.getBalance().compareTo(required) < 0) {
                    return new TransferResult(false, "transfer rejected (insufficient funds)", BigDecimal.ZERO, req);
                }
                // Enough funds: perform moves
                from.debit(req.amount); // debit amount
                from.debit(feePerTransfer); // debit fee
                to.credit(req.amount); // credit receiver

                // Ledger entries: debit, credit, fee
                ledger.addEntry(new LedgerEntry(LedgerEntry.Type.DEBIT, from.getId(), req.amount.negate(), "debit transfer to " + to.getId()));
                ledger.addEntry(new LedgerEntry(LedgerEntry.Type.CREDIT, to.getId(), req.amount, "credit transfer from " + from.getId()));
                ledger.addEntry(new LedgerEntry(LedgerEntry.Type.FEE, from.getId(), feePerTransfer.negate(), "fee for transfer to " + to.getId()));

                return new TransferResult(true, "transfer accepted", feePerTransfer, req);
            }
        }
    }

    // main
    public static void main(String[] args) {
        LedgerService ledger = new LedgerService();
        BankService bank = new BankService(ledger, new BigDecimal("1.00"));

        // 建立三個帳戶並設定初始餘額
        Account alice = new Account("A1", "Alice", new BigDecimal("200.00"));
        Account bob = new Account("B1", "Bob", new BigDecimal("20.00"));
        Account charlie = new Account("C1", "Charlie", new BigDecimal("10.00"));

        bank.addAccount(alice);
        bank.addAccount(bob);
        bank.addAccount(charlie);

        // 三筆轉帳: Alice -> Bob 120.50, Bob -> Charlie 50.00, Charlie -> Alice 9999.00
        List<TransferRequest> requests = List.of(
            new TransferRequest(alice.getId(), bob.getId(), new BigDecimal("120.50")),
            new TransferRequest(bob.getId(), charlie.getId(), new BigDecimal("50.00")),
            new TransferRequest(charlie.getId(), alice.getId(), new BigDecimal("9999.00"))
        );

        List<TransferResult> results = new ArrayList<>();
        for (TransferRequest req : requests) {
            TransferResult res = bank.transfer(req);
            results.add(res);
            // 每筆交易顯示結果，並確保包含指定字串 "transfer accepted" 或 "transfer rejected"
            if (res.accepted) {
                System.out.println(res.toString()); // contains "transfer accepted"
            } else {
                System.out.println(res.toString()); // contains "transfer rejected"
            }
        }

        // 統計
        long successCount = results.stream().filter(r -> r.accepted).count();
        long failCount = results.size() - successCount;
        BigDecimal totalFees = ledger.totalFees().abs(); // fees are stored as negative amounts, take absolute

        // 輸出最終餘額
        System.out.println();
        System.out.println("final balances:");
        System.out.println(alice.toString());
        System.out.println(bob.toString());
        System.out.println(charlie.toString());

        // 輸出 ledger 明細
        System.out.println();
        System.out.println("ledger entries:");
        for (LedgerEntry e : ledger.getEntries()) {
            System.out.println(e.toString());
        }

        // 輸出成功/失敗數與總手續費
        System.out.println();
        System.out.println("successful transfers: " + successCount);
        System.out.println("failed transfers: " + failCount);
        System.out.println("total fee: " + totalFees.setScale(2, RoundingMode.HALF_EVEN).toPlainString());
    }
}