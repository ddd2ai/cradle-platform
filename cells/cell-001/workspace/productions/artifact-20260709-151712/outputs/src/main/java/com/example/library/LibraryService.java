package com.example.library;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class LibraryService {
    private final Map<String, Book> books = new HashMap<>();
    private final Map<String, Member> members = new HashMap<>();
    private final List<Loan> loans = new ArrayList<>();
    private int nextLoanId = 1;

    public void addBook(Book book) {
        books.put(book.getId(), book);
    }

    public void addMember(Member member) {
        members.put(member.getId(), member);
    }

    public Book getBook(String bookId) {
        return books.get(bookId);
    }

    public Member getMember(String memberId) {
        return members.get(memberId);
    }

    /**
     * 嘗試借書：若庫存不足則回傳 null
     */
    public Loan loanBook(String bookId, String memberId) {
        Book book = books.get(bookId);
        Member member = members.get(memberId);
        if (book == null || member == null) return null;
        synchronized (book) {
            boolean ok = book.borrowOne();
            if (!ok) {
                return null; // 庫存不足
            }
            Loan loan = new Loan(nextLoanId++, book, member, LocalDateTime.now());
            loans.add(loan);
            return loan;
        }
    }

    public boolean returnBook(int loanId) {
        for (Loan loan : loans) {
            if (loan.getId() == loanId) {
                if (loan.isReturned()) return false;
                Book book = loan.getBook();
                synchronized (book) {
                    loan.markReturned(LocalDateTime.now());
                    book.returnOne();
                }
                return true;
            }
        }
        return false;
    }

    public List<Loan> getAllLoans() {
        return new ArrayList<>(loans);
    }

    public List<Book> getAllBooks() {
        return new ArrayList<>(books.values());
    }
}