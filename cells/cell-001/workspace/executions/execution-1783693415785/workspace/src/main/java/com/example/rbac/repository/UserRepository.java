package com.example.rbac.repository;

import com.example.rbac.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
  // custom queries if needed
}