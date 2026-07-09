import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class OrderApp {

    // Product class
    public static class Product {
        private final int id;
        private final String name;
        private final BigDecimal price;

        public Product(int id, String name, BigDecimal price) {
            this.id = id;
            this.name = name;
            this.price = price.setScale(2, RoundingMode.HALF_UP);
        }

        public int getId() { return id; }
        public String getName() { return name; }
        public BigDecimal getPrice() { return price; }

        @Override
        public String toString() {
            return name + "(id=" + id + ", price=" + price + ")";
        }
    }

    // OrderItem class
    public static class OrderItem {
        private final Product product;
        private final int quantity;

        public OrderItem(Product product, int quantity) {
            this.product = product;
            this.quantity = quantity;
        }

        public Product getProduct() { return product; }
        public int getQuantity() { return quantity; }

        public BigDecimal getSubtotal() {
            return product.getPrice().multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
        }

        @Override
        public String toString() {
            return product.getName() + " x " + quantity + " = " + getSubtotal();
        }
    }

    // Order class
    public static class Order {
        private final int id;
        private final List<OrderItem> items = new ArrayList<>();

        public Order(int id) { this.id = id; }

        public int getId() { return id; }

        public void addItem(OrderItem item) { items.add(item); }

        public List<OrderItem> getItems() { return items; }

        public BigDecimal calculateTotal() {
            BigDecimal total = BigDecimal.ZERO;
            for (OrderItem item : items) {
                total = total.add(item.getSubtotal());
            }
            return total.setScale(2, RoundingMode.HALF_UP);
        }

        @Override
        public String toString() {
            StringBuilder sb = new StringBuilder();
            sb.append("Order[id=").append(id).append("]\n");
            for (OrderItem it : items) {
                sb.append("  ").append(it.toString()).append("\n");
            }
            sb.append("Total: ").append(calculateTotal());
            return sb.toString();
        }
    }

    // InventoryService
    public static class InventoryService {
        private final Map<Integer, Integer> stockByProductId = new HashMap<>();
        private final Map<Integer, Product> products = new HashMap<>();

        public void registerProduct(Product p, int initialStock) {
            products.put(p.getId(), p);
            stockByProductId.put(p.getId(), Math.max(initialStock, 0));
        }

        public int getStock(int productId) {
            return stockByProductId.getOrDefault(productId, 0);
        }

        public Product getProduct(int productId) { return products.get(productId); }

        public boolean hasSufficientStock(int productId, int needed) {
            return getStock(productId) >= needed;
        }

        public boolean canFulfill(Order order) {
            for (OrderItem it : order.getItems()) {
                int pid = it.getProduct().getId();
                if (!hasSufficientStock(pid, it.getQuantity())) return false;
            }
            return true;
        }

        public void deduct(Order order) {
            for (OrderItem it : order.getItems()) {
                int pid = it.getProduct().getId();
                int remain = getStock(pid) - it.getQuantity();
                stockByProductId.put(pid, Math.max(remain, 0));
            }
        }

        public Map<Product, Integer> snapshotStock() {
            Map<Product, Integer> snap = new HashMap<>();
            for (Map.Entry<Integer, Integer> e : stockByProductId.entrySet()) {
                Product p = products.get(e.getKey());
                if (p != null) snap.put(p, e.getValue());
            }
            return snap;
        }
    }

    // OrderService
    public static class OrderService {
        private final InventoryService inventory;

        public OrderService(InventoryService inventory) {
            this.inventory = inventory;
        }

        public boolean processOrder(Order order) {
            if (!inventory.canFulfill(order)) {
                return false;
            }
            // 計算（雖然 Order 自身可計算，這裡示範由服務呼叫）
            BigDecimal total = order.calculateTotal();
            // 扣庫存
            inventory.deduct(order);
            // 在真實系統會持久化訂單、發送通知等
            return true;
        }
    }

    public static void main(String[] args) {
        // 建立三個商品
        Product p1 = new Product(1, "T-Shirt", new BigDecimal("19.99"));
        Product p2 = new Product(2, "Mug", new BigDecimal("9.50"));
        Product p3 = new Product(3, "Sticker", new BigDecimal("1.20"));

        // 建立庫存並註冊商品
        InventoryService inventory = new InventoryService();
        inventory.registerProduct(p1, 10);
        inventory.registerProduct(p2, 5);
        inventory.registerProduct(p3, 100);

        // 建立訂單並加入兩個訂單項目
        Order order = new Order(1001);
        order.addItem(new OrderItem(p1, 2)); // 2 x T-Shirt
        order.addItem(new OrderItem(p2, 1)); // 1 x Mug

        // 建立 OrderService
        OrderService orderService = new OrderService(inventory);

        // 檢查庫存是否足夠
        boolean canFulfill = inventory.canFulfill(order);
        if (!canFulfill) {
            System.out.println("Cannot fulfill order: insufficient stock");
            return;
        }

        // 處理訂單（計算總金額並扣庫存）
        boolean processed = orderService.processOrder(order);
        if (!processed) {
            System.out.println("Failed to process order");
            return;
        }

        // 輸出 required 資訊
        System.out.println("order created: " + order.getId());
        System.out.println("total amount: " + order.calculateTotal());
        System.out.println("remaining stock:");
        Map<Product, Integer> remaining = inventory.snapshotStock();
        for (Map.Entry<Product, Integer> e : remaining.entrySet()) {
            System.out.println("  " + e.getKey().getName() + " (id=" + e.getKey().getId() + "): " + e.getValue());
        }

        // 額外輸出訂單摘要（可讀性用）
        System.out.println("\nOrder summary:\n" + order.toString());
    }
}