public class HelloService {

    public String sayHello() {
        return "Hello Cradle";
    }

    public static void main(String[] args) {
        HelloService service = new HelloService();
        System.out.println(service.sayHello());
    }
}