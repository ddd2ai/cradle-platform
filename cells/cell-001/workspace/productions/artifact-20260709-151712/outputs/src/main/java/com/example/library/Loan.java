package com.example.library;

import java.time.LocalDateTime;

public class Loan {
    private final int id;
    private final Book book;
    private final Member member;
    private final LocalDateTime loanDate;
    private boolean returned;
    private LocalDateTime returnDate;

    public Loan(int id, Book book, Member member, LocalDateTime loanDate) {
        this.id = id;
        this.book = book;
        this.member = member;
        this.loanDate = loanDate;
        this.returned = false;
        this.returnDate = null;
    }

    public int getId() {
        return id;
    }

    public Book getBook() {
        return book;
    }

    public Member getMember() {
        return member;
    }

    public LocalDateTime getLoanDate() {
        return loanDate;
    }

    public boolean isReturned() {
        return returned;
    }

    public LocalDateTime getReturnDate() {
        return returnDate;
    }

    public void markReturned(LocalDateTime when) {
        if (!returned) {
            returned = true;
            returnDate = when;
        }
    }

    @Override
    public String toString() {
        if (returned) {
            return String.format("Loan[%d] %s -> %s on %s (returned: %s)", id, member.getId(), book.getId(), loanDate, returnDate);
        }
        return String.format("Loan[%d] %s -> %s on %s (active)", id, member.getId(), book.getId(), loanDate);
    }
}