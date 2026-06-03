export const TOOL_REGISTRY = {

  java: {
    keywords: ["java"],
    check: "java -version",
    install: "brew install openjdk@21",
  },

  nodejs: {
    keywords: ["nodejs", "node.js", "node"],
    check: "node -v",
    install: "brew install node",
  },

  python: {
    keywords: ["python"],
    check: "python3 --version",
    install: "brew install python",
  },

  git: {
    keywords: ["git"],
    check: "git --version",
    install: "brew install git",
  },

  docker: {
    keywords: ["docker"],
    check: "docker --version",
    install: "brew install --cask docker",
  },

  maven: {
    keywords: ["maven"],
    check: "mvn -v",
    install: "brew install maven",
  },

  mariadb: {
    keywords: ["mariadb"],
    check: "docker ps --format '{{.Names}}' | grep cradle-mariadb",

    install: `
    docker run -d \
    --name cradle-mariadb \
    -e MARIADB_ROOT_PASSWORD=root \
    -e MARIADB_DATABASE=cradle \
    -p 3306:3306 \
    mariadb:latest
    `,
  },

  postgresql: {
    keywords: ["postgresql", "postgres"],
    check: "docker ps --format '{{.Names}}' | grep cradle-postgres",

    install: `
    docker run -d \
    --name cradle-postgres \
    -e POSTGRES_PASSWORD=root \
    -e POSTGRES_DB=cradle \
    -p 5432:5432 \
    postgres:latest
    `,
  },

  redis: {
    keywords: ["redis"],
    check: "docker ps --format '{{.Names}}' | grep cradle-redis",

    install: `
    docker run -d \
    --name cradle-redis \
    -p 6379:6379 \
    redis:latest
    `,
  },

  rabbitmq: {
    keywords: ["rabbitmq"],
    check: "docker ps --format '{{.Names}}' | grep cradle-rabbitmq",

    install: `
    docker run -d \
    --name cradle-rabbitmq \
    -p 5672:5672 \
    -p 15672:15672 \
    rabbitmq:management
    `,
  },

};