package com.example.rbacexample.model;

import java.util.Set;

public class User {
    private String username;
    private Set<Role> roles;

    public User(String username, Set<Role> roles) {
        this.username = username;
        this.roles = roles;
    }

    // getters and setters
}