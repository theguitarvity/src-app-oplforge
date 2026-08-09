declare module 'des.js' {
  interface DesCipher {
    update(data: Buffer): number[]
    final(): number[]
  }

  const des: {
    DES: {
      create(options: { type: 'encrypt' | 'decrypt'; key: Buffer; padding?: boolean }): DesCipher
    }
  }

  export default des
}
