package com.atharva.offlineupi.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.atharva.offlineupi.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    
    // Spring Boot magically writes the SQL for this just by reading the method name!
    Optional<User> findByPhoneNumber(String phoneNumber);
}