package com.example.cradlerbacdemo.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/user")
public class UserController {

    // 公開可存取
    @GetMapping("/public-info")
    public String publicInfo() {
        return "[public] 這是公開資訊";
    }

    // 需要已驗證使用者
    @GetMapping("/profile")
    public String profile() {
        return "[user] 這是使用者自己的個人資料（模擬）";
    }

    // 使用自訂權限檢查
    @PreAuthorize("hasAuthority('PROFILE:VIEW') or hasRole('ADMIN')")
    @GetMapping("/private-profile")
    public String privateProfile() {
        return "[user] 私密個人資料：需要 PROFILE:VIEW 權限";
    }
}