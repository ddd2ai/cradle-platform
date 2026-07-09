package com.example.cradlerbacdemo.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/manager")
public class ManagerController {

    // 需要 ORDER:MANAGE 權限或 ROLE_MANAGER
    @PreAuthorize("hasAuthority('ORDER:MANAGE') or hasRole('MANAGER')")
    @PostMapping("/process-order")
    public String processOrder() {
        return "[manager] 處理訂單：成功（模擬）";
    }

    // 報表檢視，需要 REPORT:VIEW 權限
    @PreAuthorize("hasAuthority('REPORT:VIEW')")
    @GetMapping("/view-report")
    public String viewReport() {
        return "[manager] 檢視報表：成功（模擬）";
    }
}