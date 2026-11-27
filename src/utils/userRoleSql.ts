/**
 * Devuelve una subconsulta SQL reutilizable para resolver el rol musical del usuario
 * a partir de "UserRole" y "Role", combinando 'Productor' y 'Artista' en
 * 'Productor y Artista', e ignorando por completo el rol de cuenta 'Usuario'.
 */
export function getMusicalRoleSql(userAlias = 'u'): string {
  return `COALESCE(
    (
      SELECT
        CASE
          WHEN BOOL_OR(r.name = 'Productor') AND BOOL_OR(r.name = 'Artista') THEN 'Productor y Artista'
          WHEN BOOL_OR(r.name = 'Productor') THEN 'Productor'
          WHEN BOOL_OR(r.name = 'Artista') THEN 'Artista'
          ELSE NULL
        END
      FROM "UserRole" ur
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE ur."userId" = ${userAlias}.id
        AND r.name IN ('Productor', 'Artista')
    ),
    CASE WHEN ${userAlias}."accountRole" = 'Administrador' THEN 'Administrador' ELSE 'Artista' END
  )`
}
