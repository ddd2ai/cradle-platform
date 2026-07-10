package com.example.rbac.service;

import com.example.rbac.entity.User;
import com.example.rbac.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserService {
  @Autowired
  private UserRepository userRepository;

  public User createUser(User user) {
    return userRepository.save(user);
  }
}