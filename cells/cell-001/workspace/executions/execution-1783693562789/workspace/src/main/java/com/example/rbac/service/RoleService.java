package com.example.rbac.service;

import com.example.rbac.entity.Role;
import com.example.rbac.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class RoleService {
  @Autowired
  private RoleRepository roleRepository;

  public Role createRole(Role role) {
    return roleRepository.save(role);
  }
}