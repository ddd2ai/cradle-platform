# 簡易 RBAC 權限管理系統

這是一個使用 Spring Boot 和 H2 資料庫的簡單角色基礎存取控制（RBAC）權限管理系統。

## 功能特點
- 使用者註冊
- 角色分配
- 基本的 RBAC 構架

## 技術棧
- Spring Boot
- Spring Data JPA
- H2 資料庫

## 快速開始

1. 安裝 Maven
2. 克隆這個儲存庫
3. 執行 `mvn clean install`
4. 執行 `mvn spring-boot:run`
5. 訪問 H2 Console 進行資料庫操作（http://localhost:8080/h2-console）