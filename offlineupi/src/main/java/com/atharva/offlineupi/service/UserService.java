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

    // Register a new user
    public User registerUser(String fullName, String phoneNumber, String pinHash) {
        // Check if phone already registered
        if (userRepository.findByPhoneNumber(phoneNumber).isPresent()) {
            throw new RuntimeException("Phone number already registered!");
        }

        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setFullName(fullName);
        user.setPhoneNumber(phoneNumber);
        user.setPinHash(pinHash);
        user.setCloudBalance(new BigDecimal("1000.00"));

        return userRepository.save(user);
    }

    // Login with phone + PIN
    public User loginUser(String phoneNumber, String pinHash) {
        User user = userRepository.findByPhoneNumber(phoneNumber)
            .orElseThrow(() -> new RuntimeException("No account found with this phone number!"));

        if (!user.getPinHash().equals(pinHash)) {
            throw new RuntimeException("Incorrect PIN!");
        }

        return user;
    }

    // Get balance
    public BigDecimal getBalance(String userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found!"));
        return user.getCloudBalance();
    }
}