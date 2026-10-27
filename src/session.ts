let handler = () => {}

export function onUnauthorized(next: () => void) {
  handler = next
  return () => {
    if (handler === next) handler = () => {}
  }
}

export function unauthorized() {
  handler()
}
