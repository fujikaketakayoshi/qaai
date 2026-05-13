const wpUser = process.env.WORDPRESS_USER!;
const wpPassword = process.env.WORDPRESS_APP_PASSWORD!;

const token = Buffer
  .from(`${wpUser}:${wpPassword}`)
  .toString("base64");

export const wpHeaders = {
  "Content-Type": "application/json",
  "Authorization": `Basic ${token}`
};

export const wpUrl = process.env.WORDPRESS_URL!;