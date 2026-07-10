package com.example.rbacexample.service;

import com.example.rbacexample.model.Role;
import com.example.rbacexample.model.Permission;
import com.example.rbacexample.model.User;

import java.util.HashSet;
import java.util.Set;

public class RbacService {
    public boolean hasPermission(User user, Permission permission) {
        for (Role role : user.getRoles()) {
            if (role.getPermissions().contains(permission)) {
                return true;
            }
        }
        return false;
    }
}