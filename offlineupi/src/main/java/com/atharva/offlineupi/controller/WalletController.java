package com.atharva.offlineupi.controller;

import java.math.BigDecimal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.atharva.offlineupi.service.WalletService;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    public record LoadWalletRequest(String userId, BigDecimal amount) {}
    public record SettleRequest(String receiverId, String tokenId) {}

    // POST http://localhost:8080/api/wallet/load
    @PostMapping("/load")
    public ResponseEntity<String> loadOfflineWallet(@RequestBody LoadWalletRequest request) {
        String jwt = walletService.loadOfflineWallet(request.userId(), request.amount());
        return ResponseEntity.ok(jwt);
    }

    // POST http://localhost:8080/api/wallet/settle
    @PostMapping("/settle")
    public ResponseEntity<String> settleTransaction(@RequestBody SettleRequest request) {
        walletService.settleTransaction(request.receiverId(), request.tokenId());
        return ResponseEntity.ok("Transaction Settled Successfully!");
    }
}