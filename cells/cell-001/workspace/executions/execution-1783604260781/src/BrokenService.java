public class BrokenService {
    public String sayHello() {
        return "Hello Cradle";
    }

    public static void main(String[] args) {
        System.out.println(new BrokenService().sayHello());
    }
}