declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;

    WORDPRESS_URL: string;
    WORDPRESS_USER: string;
    WORDPRESS_APP_PASSWORD: string;
  }
}
