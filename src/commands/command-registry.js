export class CommandRegistry {
  constructor() {
    this.commands = [];
  }

  register(command) {
    this.commands.push(command);
  }

  registerAll(commands) {
    for (const command of commands) {
      this.register(command);
    }
  }

  find(input, context) {
    return this.commands.find((command) => command.match(input, context));
  }

  list() {
    return this.commands;
  }
}