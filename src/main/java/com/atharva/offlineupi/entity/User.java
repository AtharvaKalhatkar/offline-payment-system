package com.atharva.offlineupi.entity; // Make sure this matches your actual package name

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

    @Id
    private String id; // We will generate a unique UUID for this later

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 15)
    private String phoneNumber;

    // Why BigDecimal? Because using 'Double' for money causes rounding errors!
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cloudBalance = BigDecimal.ZERO; 

    @Column(columnDefinition = "TEXT")
    private String publicKey; // To verify the offline Bluetooth signatures

    @Column(nullable = false)
    private String pinHash;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    // --- GETTERS AND SETTERS ---
    // If you are using Lombok, you can delete all of these and just put @Data at the top of the class.
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public BigDecimal getCloudBalance() { return cloudBalance; }
    public void setCloudBalance(BigDecimal cloudBalance) { this.cloudBalance = cloudBalance; }

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public String getPinHash() { return pinHash; }
    public void setPinHash(String pinHash) { this.pinHash = pinHash; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}