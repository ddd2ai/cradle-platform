package com.example.library;

public class Book {
    private final String id;
    private final String title;
    private final int totalCopies;
    private int availableCopies;

    public Book(String id, String title, int totalCopies) {
        this.id = id;
        this.title = title;
        this.totalCopies = Math.max(0, totalCopies);
        this.availableCopies = this.totalCopies;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public int getTotalCopies() {
        return totalCopies;
    }

    public int getAvailableCopies() {
        return availableCopies;
    }

    public boolean borrowOne() {
        if (availableCopies <= 0) return false;
        availableCopies--;
        return true;
    }

    public void returnOne() {
        if (availableCopies < totalCopies) {
            availableCopies++;
        }
    }

    @Override
    public String toString() {
        return String.format("%s - %s (available: %d/%d)", id, title, availableCopies, totalCopies);
    }
}