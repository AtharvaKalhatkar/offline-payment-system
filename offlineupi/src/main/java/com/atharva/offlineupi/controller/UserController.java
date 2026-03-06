package com.atharva.offlineupi.controller;

import java.math.BigDecimal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.atharva.offlineupi.entity.User;
import com.atharva.offlineupi.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // A quick blueprint (Record) for the incoming JSON request
    public record RegisterRequest(String fullName, String phoneNumber, String pinHash) {}

    // POST http://localhost:8080/api/users/register
    @PostMapping("/register")
    public ResponseEntity<User> registerUser(@RequestBody RegisterRequest request) {
        User newUser = userService.registerUser(
            request.fullName(), 
            request.phoneNumber(), 
            request.pinHash()
        );
        return ResponseEntity.ok(newUser);
    }

    // GET http://localhost:8080/api/users/{id}/balance
    @GetMapping("/{id}/balance")
    public ResponseEntity<BigDecimal> getBalance(@PathVariable String id) {
        return ResponseEntity.ok(userService.getBalance(id));
    }
}