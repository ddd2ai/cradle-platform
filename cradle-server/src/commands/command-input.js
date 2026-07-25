export function commandArgs(input, commandName) {
  return input.slice(commandName.length).trim();
}

export function splitFirstArg(input, commandName) {
  const args = commandArgs(input, commandName);
  const firstSpaceIndex = args.indexOf(" ");

  if (firstSpaceIndex === -1) {
    return {
      first: args,
      rest: "",
    };
  }

  return {
    first: args.slice(0, firstSpaceIndex).trim(),
    rest: args.slice(firstSpaceIndex + 1).trim(),
  };
}
