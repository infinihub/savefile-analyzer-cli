declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly CI?: string;
    }
  }
}

export {};
