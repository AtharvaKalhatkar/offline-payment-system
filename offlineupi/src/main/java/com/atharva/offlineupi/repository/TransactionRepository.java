package com.atharva.offlineupi.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.atharva.offlineupi.entity.Transaction;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
}