// Update with your config settings.

/**
 * @type { Knex.Config | string }
 */

  export const development = {
    client: 'postgresql',
    connection: {
      database: 'assignobot',
      user:     'postgres',
      password: 'master96'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
