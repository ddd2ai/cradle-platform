package com.example.cradlerbacdemo.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminController {

    // 只有 ROLE_ADMIN 或具備 USER:CREATE 權限的使用者
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('USER:CREATE')")
    @PostMapping("/create-user")
    public String createUser() {
        return "[admin] 建立使用者：成功（模擬）";
    }

    // 只有 ROLE_ADMIN 且具備 USER:DELETE 權限
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('USER:DELETE')")
    @PostMapping("/delete-user")
    public String deleteUser() {
        return "[admin] 刪除使用者：成功（模擬）";
    }
}