package com.example.rbac.controller;

import com.example.rbac.entity.Role;
import com.example.rbac.service.RoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/roles")
public class RoleController {
  @Autowired
  private RoleService roleService;

  @PostMapping
  public Role createRole(@RequestBody Role role) {
    return roleService.createRole(role);
  }
}