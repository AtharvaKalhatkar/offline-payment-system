package com.atharva.offlineupi.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.atharva.offlineupi.entity.OfflineToken;
import com.atharva.offlineupi.entity.Transaction;
import com.atharva.offlineupi.entity.User;
import com.atharva.offlineupi.repository.OfflineTokenRepository;
import com.atharva.offlineupi.repository.TransactionRepository;
import com.atharva.offlineupi.repository.UserRepository;

@Service
public class WalletService {

    private final UserRepository userRepository;
    private final OfflineTokenRepository tokenRepository;
    private final TransactionRepository transactionRepository;

    public WalletService(UserRepository userRepo, OfflineTokenRepository tokenRepo, TransactionRepository txRepo) {
        this.userRepository = userRepo;
        this.tokenRepository = tokenRepo;
        this.transactionRepository = txRepo;
    }

    // Phase 1: Creating the Escrow Token (User clicks "Load Offline Wallet")
    @Transactional
    public String loadOfflineWallet(String userId, BigDecimal amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getCloudBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient cloud balance!");
        }

        // 1. Deduct money from cloud balance (Escrow)
        user.setCloudBalance(user.getCloudBalance().subtract(amount));
        userRepository.save(user);

        // 2. Create the Token record
        String nonce = UUID.randomUUID().toString();
        OfflineToken token = new OfflineToken();
        token.setTokenId(nonce);
        token.setSenderId(userId);
        token.setAmount(amount);
        token.setExpiresAt(LocalDateTime.now().plusDays(1)); // Valid for 24 hours
        
        // *NOTE: In Phase 2, we will replace this dummy string with a real Cryptographic JWT!*
        token.setJwtPayload("DUMMY_JWT_PAYLOAD_FOR_" + nonce); 
        
        tokenRepository.save(token);

        return token.getJwtPayload();
    }

    // Phase 3: The Settlement (Receiver gets back to Wi-Fi)
    @Transactional
    public void settleTransaction(String receiverId, String tokenId) {
        // 1. Find the token and verify it hasn't been spent
        OfflineToken token = tokenRepository.findById(tokenId)
                .orElseThrow(() -> new RuntimeException("Invalid Token!"));

        if (!token.getStatus().equals("ACTIVE")) {
            throw new RuntimeException("Token already spent or expired!");
        }

        // 2. Add money to Receiver
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));
        receiver.setCloudBalance(receiver.getCloudBalance().add(token.getAmount()));
        userRepository.save(receiver);

        // 3. Mark Token as spent
        token.setStatus("SPENT");
        tokenRepository.save(token);

        // 4. Log the final receipt
        Transaction tx = new Transaction();
        tx.setSenderId(token.getSenderId());
        tx.setReceiverId(receiverId);
        tx.setTokenId(tokenId);
        tx.setAmount(token.getAmount());
        transactionRepository.save(tx);
    }
}