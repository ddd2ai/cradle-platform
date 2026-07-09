package com.example.library;

import java.util.List;

public class LibraryLoanApp {
    public static void main(String[] args) {
        LibraryService svc = new LibraryService();

        // 建立三本書
        Book b1 = new Book("B1", "Clean Code", 2);
        Book b2 = new Book("B2", "Design Patterns", 1);
        Book b3 = new Book("B3", "Refactoring", 0);
        svc.addBook(b1);
        svc.addBook(b2);
        svc.addBook(b3);

        // 建立兩位會員
        Member m1 = new Member("M1", "Alice");
        Member m2 = new Member("M2", "Bob");
        svc.addMember(m1);
        svc.addMember(m2);

        // 執行借書、還書、庫存不足拒絕
        // 1) M1 借 B1 -> accepted
        Loan loan1 = svc.loanBook("B1", "M1");
        if (loan1 != null) {
            System.out.println("loan accepted: " + loan1);
        } else {
            System.out.println("loan rejected: M1 -> B1");
        }

        // 2) M2 借 B2 -> accepted
        Loan loan2 = svc.loanBook("B2", "M2");
        if (loan2 != null) {
            System.out.println("loan accepted: " + loan2);
        } else {
            System.out.println("loan rejected: M2 -> B2");
        }

        // 3) M1 嘗試借 B2 -> rejected (庫存不足)
        Loan loan3 = svc.loanBook("B2", "M1");
        if (loan3 != null) {
            System.out.println("loan accepted: " + loan3);
        } else {
            System.out.println("loan rejected: M1 -> B2");
        }

        // 4) 嘗試借 B3 -> rejected (total 0)
        Loan loan4 = svc.loanBook("B3", "M1");
        if (loan4 != null) {
            System.out.println("loan accepted: " + loan4);
        } else {
            System.out.println("loan rejected: M1 -> B3");
        }

        // 5) M2 還 B2
        if (loan2 != null && svc.returnBook(loan2.getId())) {
            System.out.println("book returned: Loan[%d]".formatted(loan2.getId()));
        } else {
            System.out.println("book returned: failed for Loan" + (loan2 == null ? "(none)" : loan2.getId()));
        }

        // 6) M1 再次借 B2 -> accepted (因為已還)
        Loan loan5 = svc.loanBook("B2", "M1");
        if (loan5 != null) {
            System.out.println("loan accepted: " + loan5);
        } else {
            System.out.println("loan rejected: M1 -> B2 (after return)");
        }

        // 最後輸出 inventory
        System.out.println("inventory:");
        List<Book> allBooks = svc.getAllBooks();
        for (Book b : allBooks) {
            System.out.println(b.toString());
        }

        // 最後輸出 loan records
        System.out.println("loan records:");
        List<Loan> allLoans = svc.getAllLoans();
        for (Loan l : allLoans) {
            System.out.println(l.toString());
        }
    }
}