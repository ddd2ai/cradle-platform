# CradleRbacDemo

簡介：這是一個示範公司內部常見 RBAC（角色 + 權限）情境的最小 Spring Boot 專案。使用 InMemoryUserDetailsManager 建立範例使用者與權限，並以 Controller + @PreAuthorize 演示授權策略。

## 內含範例使用者

- alice.admin / adminpass  -> ROLE_ADMIN, 權限：USER:CREATE, USER:DELETE, ORDER:MANAGE
- bob.manager / managerpass -> ROLE_MANAGER, 權限：ORDER:MANAGE, REPORT:VIEW
- carol.user / userpass -> ROLE_USER, 權限：PROFILE:VIEW

## 範例 endpoints

- GET /public/public-info        （無需認證）
- GET /user/profile              （需已認證）
- GET /user/private-profile      （需 PROFILE:VIEW 或 ROLE_ADMIN）
- POST /admin/create-user        （需 ROLE_ADMIN 或 USER:CREATE）
- POST /admin/delete-user        （需 ROLE_ADMIN 且 USER:DELETE）
- POST /manager/process-order    （需 ORDER:MANAGE 或 ROLE_MANAGER）
- GET /manager/view-report       （需 REPORT:VIEW）

## 執行

1. 編譯並執行：

   mvn package
   java -jar target/cradle-rbac-demo-0.0.1-SNAPSHOT.jar

2. 測試（使用 curl）：

   # 無需認證的公開
   curl http://localhost:8080/public/public-info

   # 使用者範例 - 取得個人頁面
   curl -u carol.user:userpass http://localhost:8080/user/profile

   # 管理員建立使用者（示範權限）
   curl -X POST -u alice.admin:adminpass http://localhost:8080/admin/create-user

   # 經理處理訂單
   curl -X POST -u bob.manager:managerpass http://localhost:8080/manager/process-order

## 說明

此專案以最小化設定示範 RBAC：角色（ROLE_XXX）與自訂權限（authority strings）可以同時存在，並可使用 Spring Security 的 `@PreAuthorize` 進行細粒度存取控制。可擴充為使用資料庫儲存使用者與權限，或整合 OAuth2 / JWT 等真實認證方案。