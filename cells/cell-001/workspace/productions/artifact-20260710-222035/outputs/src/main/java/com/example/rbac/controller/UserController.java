package com.example.rbac.controller;

import com.example.rbac.entity.User;
import com.example.rbac.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {
  @Autowired
  private UserService userService;

  @PostMapping
  public User createUser(@RequestBody User user) {
    return userService.createUser(user);
  }
}