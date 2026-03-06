package com.atharva.offlineupi.service;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.atharva.offlineupi.entity.User;
import com.atharva.offlineupi.repository.UserRepository;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // Method to register a new user
    public User registerUser(String fullName, String phoneNumber, String pinHash) {
        User user = new User();
        user.setId(UUID.randomUUID().toString()); // Generate a unique secure ID
        user.setFullName(fullName);
        user.setPhoneNumber(phoneNumber);
        user.setPinHash(pinHash);
        
        // Let's give every new user ₹1000 for testing purposes!
        user.setCloudBalance(new BigDecimal("1000.00")); 
        
        return userRepository.save(user); // Saves to PostgreSQL
    }

    // Method to check balance
    public BigDecimal getBalance(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found in the database!"));
            
        return user.getCloudBalance();
    }
}