export function joinPath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^([A-Za-z]):\//, '$1:/')
}

export function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop() ?? value
}
