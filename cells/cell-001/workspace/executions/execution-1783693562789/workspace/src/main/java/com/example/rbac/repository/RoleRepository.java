package com.example.rbac.repository;

import com.example.rbac.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Long> {
  // custom queries if needed
}