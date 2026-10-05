# Conecta Infusion: reglas de negocio acordadas

Estado: decisiones confirmadas durante la entrevista, registradas el 1 de octubre de 2026.
Documento principal: [intención del producto confirmada (en inglés)](../intent/conecta-infusion.md).
Idioma: **Español** | [English](agreed-business-rules.md).

Ambas versiones deben mantenerse equivalentes y actualizarse en el mismo cambio. Conservar la numeración, los ejemplos, las excepciones y las preguntas pendientes; ninguna traducción introduce decisiones nuevas.

Estos son requisitos para una implementación futura. Los ejemplos ilustran las reglas; no constituyen un catálogo completo ni demuestran que las funciones ya existan. Las correcciones explícitas posteriores de la entrevista sustituyen las suposiciones anteriores.

## 1. Estudio, idioma y configuración

- El estudio admite varias disciplinas, entre ellas yoga, ballet, entrenamiento funcional y K-pop.
- La administración crea la información de las clases que ven los clientes, incluidas descripciones, fotos y videos, y administra los horarios.
- El español es el idioma principal de la aplicación; el inglés estará disponible desde el inicio.
- La operación inicial será en México, con MXN. El país y la moneda deben poder configurarse a futuro; la compatibilidad real del proveedor de pagos con cada país se evaluará por separado.
- El cupo inicial es de 16 personas por clase, se guarda en la configuración de la aplicación y la administración puede modificarlo. Falta especificar los ajustes por sesión y su efecto en las clases ya programadas.
- El precio inicial de una clase individual es de 150 MXN y puede modificarlo la administración autorizada.
- La página pública de inicio, la navegación, el estilo visual y los diseños adaptables a distintos tamaños de pantalla se definirán en la siguiente etapa.

## 2. Separación financiera y cobro

- Las ventas, los gastos y los reportes financieros del estudio y de la cafetería se registran por separado.
- Cada área tiene una cuenta de cobro configurable de forma independiente. Al principio, ambas pueden utilizar la misma cuenta y después operar por separado.
- Los clientes pueden pagar en línea o en persona. Se comenzará con un proveedor de pagos en línea, en lugar de tres integraciones.
- Mercado Pago Checkout Pro es la recomendación de trabajo, no una decisión definitiva sobre el proveedor. PayPal y la aceptación directa de tarjetas se consideraron como alternativas.
- Los clientes sin créditos vigentes pueden consultar los horarios, pero no pueden reservar sin comprar una clase individual o un paquete.
- Para pagos en persona, el personal registra el pago y habilita los créditos correspondientes antes de realizar una reserva. Este requisito sustituye la idea anterior de reservar primero y pagar después.
- Aún no se especifican los flujos de registro de gastos, el detalle de los reportes financieros, los reembolsos, los impuestos ni la liquidación y conciliación de pagos.

## 3. Paquetes, valor de los créditos, vencimiento y selección

- Un crédito de clase puede utilizarse en cualquier disciplina; los paquetes no se restringen por disciplina.
- Los paquetes ofrecen precios por clase con descuento. Cada crédito conserva su valor de compra original para calcular el pago al instructor, incluso si se comparte o se extiende su vigencia.
- El paquete de entrada/prueba ofrece **tres clases por el precio de dos**. Esto corrige el ejemplo inicial de tres por una.
- Los créditos vencen a los 30 días.
- La compra de un paquete que permite renovar la vigencia, es decir, cualquiera excepto el de entrada/prueba, combina los créditos restantes aún vigentes con los nuevos y otorga al saldo combinado una nueva vigencia de 30 días desde la fecha de compra.
- La compra del paquete de entrada/prueba no extiende la vigencia de los créditos existentes.
- Los créditos vencidos no se recuperan automáticamente. El personal puede restablecerlos manualmente.
- La renovación modifica la fecha de vencimiento, no el valor monetario original de los créditos existentes.
- Al reservar, se utiliza primero el crédito que vence antes. Si las fechas de vencimiento coinciden, se utiliza primero el crédito comprado más antiguo.
- Los créditos deben estar vigentes en la fecha de la clase reservada, no solamente al hacer la reserva.
- La reserva aparta el crédito; la asistencia, la cancelación tardía o la inasistencia lo consumen según las reglas siguientes.

## 4. Reservas, cancelaciones y cupo

- Todo el personal y los instructores pueden asistir gratuitamente a cualquier clase y reservar un lugar. Sus reservas gratuitas pueden ser desplazadas cuando la clase se llena; la persona afectada debe recibir una notificación.
- Cuando una clase alcanza su cupo pero incluye una reserva gratuita del personal o de un instructor, un cliente que paga todavía puede reservar y reemplazar automáticamente una de esas reservas. Se notifica a la persona desplazada. La asistencia pagada incluye reservas con créditos de paquetes comprados, no solo compras de clases individuales.
- Si hay varias reservas gratuitas del personal o de instructores que puedan reemplazarse, se desplaza primero la reserva realizada más recientemente, conservando la prioridad de las reservas anteriores.
- El envío de notificaciones y el tratamiento determinista de reservas con la misma fecha y hora se definirán en créditos y reservas.
- La asistencia gratuita del personal o de instructores no genera pago al instructor porque no se consume ningún crédito pagado. No se debe asignar un valor de crédito pagado a este beneficio de asistencia.

- Los clientes pueden reservar y cancelar desde la primera versión.
- Cancelar con al menos dos horas de anticipación libera el crédito apartado sin consumirlo.
- Cancelar con menos de dos horas de anticipación consume el crédito. La inasistencia también consume un crédito.
- Las excepciones especiales se atienden mediante ajustes manuales de créditos realizados por el personal.
- Una clase sin lugares disponibles ni reservas gratuitas del personal o de instructores que puedan reemplazarse sigue visible y aparece como Llena / Full; se deshabilitan las nuevas reservas. Las clases que alcanzan su cupo pero tienen una reserva gratuita reemplazable deben permitir la reserva del cliente que paga descrita anteriormente; el texto que se muestra se definirá en la especificación de reservas.
- La primera versión no requiere lista de espera. Una cancelación que libera un lugar permite una nueva reserva.
- Los clientes pueden enviar comentarios privados al personal para solicitar sesiones adicionales de una clase llena.
- Una función posterior podría mostrar los horarios seleccionados por otros miembros. Su audiencia y funcionamiento detallado siguen pendientes; consultar la [incidencia #1](https://github.com/LFGJ-personal/ConectaInfusionApp/issues/1).

## 5. Créditos compartidos y salida del grupo familiar

- Cada cliente puede pertenecer a un solo grupo familiar activo a la vez. Para crear otro grupo o aceptar pertenecer a otro, primero debe salir del grupo actual conforme a las reglas existentes de salida y créditos. Se conservan las pertenencias históricas.

- Cuando se retira a un integrante del grupo familiar, sus propios créditos comprados sin usar y sin reservar que correspondan regresan a su cuenta, salvo que elija explícitamente dejarlos con la familia. Quien lo retira no puede ceder sus créditos en su nombre. Los créditos apartados para reservas válidas permanecen vinculados, y el valor y vencimiento de los créditos no cambian.

- Cualquier integrante activo con cuenta independiente del grupo familiar puede invitar a otro integrante; se requiere aceptación antes de incorporarse. Los integrantes pueden salir voluntariamente. Solo el responsable actual del grupo o los administradores o la gerencia pueden retirar a otro integrante. La salida obligada sigue las reglas existentes sobre créditos al salir y se registra en el historial de auditoría; no otorga autoridad sobre los responsables de perfiles dependientes.

- Las madres o padres pueden convertir los datos guardados del menor en un perfil dependiente conservando el historial de reservas vinculado. Un responsable autorizado puede solicitar una cuenta independiente para el menor. La persona confirma su correo electrónico y establece una contraseña; entonces la transición se completa automáticamente sin aprobación de los administradores o la gerencia. Las cuentas independientes no tienen requisito de edad mínima. Se conservan la identidad del perfil, el historial de reservas y la pertenencia familiar; termina el acceso de gestión de todos los responsables al perfil ahora independiente, conservando los registros históricos de autorización.

- Los integrantes independientes tienen su propia cuenta y pueden reservar utilizando el saldo compartido de créditos familiares. Los menores pueden tener un perfil dependiente sin correo electrónico ni acceso propio; su madre o padre gestiona el perfil y reserva clases para ellos desde su propia cuenta. La reserva identifica al menor como asistente y a la madre o padre como quien realiza la acción.
- Un perfil dependiente puede tener varias madres, padres o tutores autorizados que pueden gestionarlo y reservar para el menor. Una madre, padre o tutor también puede reservar una clase infantil (por ejemplo, Yoga Kids) directamente desde su propia cuenta sin crear primero un perfil dependiente. El asistente sigue siendo el menor, no la persona que reserva. Estas reservas requieren el nombre y la edad del menor para que el personal sepa quién asistirá. El cliente puede ingresar estos datos mediante campos de texto sencillos, guardarlos en su cuenta y reutilizarlos en reservas posteriores sin crear un perfil dependiente. La vinculación posterior con un perfil dependiente conserva el historial de reservas.
- Los clientes pueden crear su propio grupo familiar e invitar integrantes. Cada invitación requiere aceptación antes de que la persona se incorpore al grupo y comparta sus créditos. Los administradores o la gerencia pueden ayudar a gestionar el grupo; esta ayuda no elimina el requisito de aceptación.
- Una madre, padre o tutor ya autorizado puede invitar a otro responsable a un perfil dependiente. La persona invitada debe aceptar antes de obtener acceso para gestionar el perfil o reservar para ese menor. Los administradores o la gerencia pueden ayudar con estas invitaciones; la aceptación sigue siendo obligatoria. Pertenecer al grupo familiar no otorga por sí solo acceso como responsable del menor.
- Solo los administradores o la gerencia pueden retirar a otro responsable de un perfil dependiente. Un responsable puede retirarse a sí mismo. La eliminación debe dejar al menos un responsable activo y autorizado para un perfil dependiente activo; una invitación pendiente no cumple este requisito.
- Al eliminar su cuenta, un responsable puede transferir la responsabilidad a otra persona que acepte primero, o elegir desactivar tanto su cuenta como el perfil dependiente, conservando el historial. Esta desactivación conjunta es una excepción explícita porque el perfil dependiente también queda inactivo. Si queda otro responsable activo y autorizado, eliminar la cuenta de un responsable mantiene activo el perfil dependiente y conserva el acceso de los demás responsables. La desactivación conjunta del responsable y del perfil dependiente solo se aplica cuando no queda otro responsable activo y autorizado.
- Mientras un cliente pertenece a una familia, sus créditos se comparten automáticamente. Para dejar de compartirlos, debe salir del grupo familiar.
- Los créditos conservan la identidad del comprador, el valor original y el vencimiento.
- Un integrante que sale puede retirar únicamente sus propios créditos sin usar y sin reservar, o elegir dejarlos con la familia. No puede retirar créditos comprados por otra persona.
- Los integrantes que permanecen conservan el saldo familiar, sujeto a la decisión del comprador que sale.
- El creador o responsable actual del grupo familiar, o los administradores o la gerencia, pueden cerrar el grupo. El creador pierde el permiso de cierre al salir y puede elegir a un integrante que permanezca como nuevo responsable con permiso de cierre. Esto cambia la responsabilidad del grupo, no la identidad histórica del creador, la propiedad de los créditos ni la autorización sobre perfiles dependientes. El sucesor debe aceptar antes de obtener la responsabilidad y el permiso de cierre. Si rechaza, la transferencia no se realiza; el creador puede proponer a otra persona antes de salir o salir sin que nadie haya aceptado, perdiendo su permiso de cierre. Hasta que un sucesor acepte, los administradores o la gerencia pueden gestionar o cerrar el grupo, y el último integrante que permanece puede cerrarlo. El rechazo o la espera de aceptación no altera los créditos ni las reservas; la salida sigue las reglas de créditos acordadas. El cierre, la transferencia de responsabilidad y el destino de los créditos se registran en el historial de auditoría.
- Al cerrar el grupo familiar, incluido cuando no quedan integrantes, los créditos restantes sin usar y sin reservar regresan a sus compradores originales, incluidos los créditos cedidos previamente al grupo. Conservan su valor monetario y vencimiento; no se reactivan créditos consumidos o vencidos ni se genera un reembolso. Los créditos apartados para reservas válidas permanecen vinculados a esas reservas.
- Las reservas existentes siguen siendo válidas después de la salida. Los créditos apartados permanecen vinculados a esas reservas y no pueden retirarse de inmediato.
- Si una de esas reservas se cancela posteriormente a tiempo, el crédito liberado regresa al comprador que salió si eligió llevarse sus créditos; de lo contrario, permanece en el saldo familiar.
- Un crédito liberado conserva su valor monetario original y su fecha de vencimiento. Salir de la familia o cancelar una reserva no reinicia su vigencia.

## 6. Ajustes manuales e historial de auditoría

- Se conserva el historial de reservas, pagos, nómina y auditoría después de desactivar una cuenta. La primera versión no elimina automáticamente estos registros. Las solicitudes de eliminación o anonimización de información personal se gestionan por separado, conservando los registros financieros requeridos. Los plazos de conservación en producción se definirán antes del lanzamiento; esta decisión no establece un plazo legal ni autoriza conservar indefinidamente toda la información personal.

- Los administradores o la gerencia pueden consultar el historial completo de auditoría operativa. Los clientes y los instructores pueden consultar únicamente sus propias transacciones pertinentes y su historial de pagos, no la auditoría completa ni registros privados de otras personas. Los permisos operativos del personal sin funciones administrativas no otorgan acceso a toda la auditoría; las cuentas con varios roles conservan el acceso autorizado por sus roles asignados.

- Todo el personal puede ajustar créditos de clientes, incluidos el restablecimiento de créditos vencidos y las excepciones.
- Restablecer un crédito comprado conserva su valor monetario original para el pago al instructor.
- Al otorgar un crédito de cortesía, el personal especifica el valor que se utilizará para pagar al instructor, aunque el cliente no haya pagado nada.
- Los ajustes registran quién los realizó, cuándo, qué cambió, la cantidad y el motivo en el historial de transacciones y auditoría.
- Las acciones del personal deben ser rastreables: quién realizó la acción, cuándo y qué cambió. Esto incluye correcciones de asistencia o sesiones y registros de pagos.
- Los plazos específicos de conservación y el diseño del almacenamiento de auditoría se definirán en la especificación.

## 7. Ingresos de instructores y asistencia

- Los propietarios, gerentes o administradores asignan a cada instructor un porcentaje según su experiencia, certificaciones y acuerdo. Los porcentajes actuales son 40 %, 50 % o 60 %.
- El pago al instructor se calcula por separado para cada crédito consumido por un cliente, usando su propio valor monetario, y después se suman los importes. No existe un pago fijo por sesión independiente de los asistentes.
- La asistencia gratuita como beneficio del personal o de instructores aporta cero a los ingresos del instructor y no consume créditos pagados. Es distinta de los créditos de cortesía otorgados a clientes por el personal, cuyo valor para el pago al instructor se asigna expresamente conforme a la sección 6.
- El porcentaje del instructor no cambia según el número de asistentes; el total que recibe sí.
- Ejemplo: créditos de 150 + 150 + 120 + 135 + 135 MXN suman 690 MXN. Con un porcentaje del 50 %, el instructor recibe 345 MXN por esa sesión.
- Si la clase se lleva a cabo, los créditos consumidos por asistencia, cancelación tardía e inasistencia generan ingresos para el instructor.
- Las cancelaciones a tiempo no generan ingresos para el instructor.
- Tanto los instructores como la administración pueden registrar asistencia y marcar una sesión como completada.
- La administración puede corregir los registros de asistencia y finalización. Los cambios se auditan.
- Los ingresos deben poder explicarse a partir de los créditos utilizados y sus valores, sin recalcular a todos los asistentes con el precio actual de la clase individual.

## 8. Nómina y confirmación de pago

- La nómina se calcula dos veces al mes: el día 15 y el último día del mes, no cada 14 días.
- La aplicación calcula los importes pendientes; la administración paga a los instructores fuera de la aplicación mediante su método habitual.
- La administración registra el importe, la fecha y el método de pago. El instructor confirma que lo recibió desde su propia cuenta.
- Tanto el registro del pago como su confirmación conservan fecha y hora en el historial, evitando depender de WhatsApp como único registro de confirmación.
- Los instructores pueden consultar sus propios ingresos e historial de pagos, incluidos los detalles y el estado de confirmación.
- Los pagos automáticos a instructores quedan fuera del alcance; no se promete su implementación futura.
- Falta especificar las horas de corte de los periodos, el cierre y aprobación, el redondeo y las correcciones posteriores al pago.

## 9. Permisos y visibilidad

| Rol o audiencia | Permisos y visibilidad confirmados |
| --- | --- |
| Propietario / administrador / gerente | Cambiar precios, asignar porcentajes a instructores, consultar las finanzas de ambas áreas y toda la nómina, registrar pagos a instructores y corregir registros de asistencia o sesiones |
| Todo el personal | Ajustar créditos con registro de auditoría; los demás permisos dependen de su función operativa |
| Recepción / personal de cafetería | Acceder a las reservas, pagos o ventas de cafetería necesarios para sus tareas diarias; no a todos los reportes financieros ni a la nómina de todos |
| Instructor | Clases asignadas, asistencia y finalización, ingresos propios, historial de pagos propio y confirmación de pagos recibidos; no a los ingresos privados de otros instructores |
| Cliente | Reservas propias e información pertinente de su cuenta, saldo familiar compartido cuando corresponda; no a la información financiera del personal |

### 9.1. Administración de cuentas y perfiles

- Cuando retirar un rol termina la elegibilidad para asistencia gratuita del personal o instructor, se cancelan las reservas gratuitas futuras sin cobrar créditos. Se conservan las reservas pagadas y el acceso como cliente si la cuenta de cliente permanece activa. Retirar un rol no termina la elegibilidad gratuita si otro rol asignado todavía la otorga.

- Desactivar una cuenta de personal o instructor termina inmediatamente el acceso y la elegibilidad para reservas gratuitas del personal. La administración debe reasignar o cancelar explícitamente las próximas sesiones que esa persona impartiría; desactivar la cuenta no cancela esas sesiones de forma silenciosa. Los ingresos ya ganados por el instructor siguen adeudados y registrados, y la administración puede registrar su pago después de la desactivación. Retirar un rol de personal o instructor manteniendo activa la cuenta de cliente conserva el acceso como cliente; esto es distinto de desactivar toda la cuenta.

- Los enlaces de confirmación y establecimiento inicial de contraseña vencen después de 24 horas; los de recuperación de contraseña, después de 1 hora; las invitaciones familiares, de responsables de menores y de responsabilidad del grupo, después de 7 días. Todos son de un solo uso. Reenviar invalida el enlace anterior, exige una espera de 60 segundos y permite como máximo 5 envíos por hora por destinatario y propósito. En desarrollo se utiliza una bandeja de correo local; el proveedor de correo de producción se seleccionará durante la planificación de implementación.

- Un mismo inicio de sesión funciona en las interfaces de clientes y administración; los roles asignados controlan el acceso. Las sesiones vencen después de 7 días, o de 30 días si se selecciona Recordarme. El restablecimiento de contraseña, la desactivación de la cuenta y los cambios de roles terminan las sesiones existentes. Los usuarios pueden cerrar sesión en todos sus dispositivos.

- Todas las cuentas activas pueden recuperar su contraseña mediante un enlace seguro de un solo uso enviado por correo electrónico. La recuperación de contraseña no reactiva una cuenta desactivada. Se aplican el vencimiento del enlace y los límites de reenvío definidos en esta sección.
- Solo los administradores o la gerencia pueden reactivar una cuenta desactivada. La reactivación conserva su historial, pero no restablece créditos vencidos ni reservas canceladas; recuperar créditos sigue requiriendo un ajuste manual con su propio registro de auditoría.
- La reactivación no restablece automáticamente la pertenencia familiar ni la autorización como responsable de un menor. La cuenta reactivada debe recibir y aceptar una nueva invitación para volver a un grupo familiar o recuperar el acceso como responsable de un perfil dependiente, conforme a los permisos de invitación existentes. Se conservan los registros históricos de pertenencia y responsabilidad.
- Solo los administradores o la gerencia pueden reactivar un perfil dependiente. Antes de reactivarlo, al menos un responsable autorizado para ese menor inmediatamente antes de la desactivación debe tener una cuenta activa y aceptar una nueva autorización. Si todas esas cuentas de responsables están desactivadas, se bloquea la reactivación del perfil dependiente. Una persona nueva sin esa relación previa no puede cumplir este requisito. La reactivación no restablece créditos vencidos ni reservas canceladas.

- Los campos personales editables del perfil son nombre, teléfono, idioma preferido y foto de perfil, sujetos a los permisos de edición de cuentas descritos a continuación. Cambiar el correo electrónico requiere confirmar la nueva dirección; este cambio se gestiona por separado de la edición habitual del perfil y no permite cambiar roles ni permisos.

- Solo los administradores o la gerencia pueden crear, actualizar o eliminar a otros instructores.
- Solo los administradores o la gerencia pueden crear, editar o desactivar cuentas de otros integrantes del personal que no son instructores. El personal conserva el permiso para actualizar sus propios datos personales, sin cambiar sus roles ni permisos.
- El personal puede actualizar únicamente su propio perfil personal; esto no autoriza cambiar su propio rol, permisos ni porcentaje de pago como instructor.
- Solo los administradores o la gerencia pueden asignar o cambiar roles de cuentas. El personal sin funciones administrativas, los instructores y los clientes no pueden cambiar sus propios roles ni los de otras personas; el registro de clientes y las invitaciones no pueden otorgar roles de personal ni de administración.
- La aplicación debe rechazar la desactivación o eliminación de roles que deje sin ninguna cuenta activa con acceso administrativo o de gerencia. Esto incluye a un administrador o gerente que intente realizar el cambio en su propia cuenta.
- Los administradores, la gerencia y el personal, incluidos los instructores, pueden crear clientes mediante el flujo de invitación por correo electrónico. Los instructores no reciben permisos adicionales para editar o desactivar a esos clientes.
- Todas las cuentas inician sesión con un correo electrónico, incluidas las cuentas administrativas y las cuentas de prueba del entorno de desarrollo.
- Una misma cuenta de correo electrónico puede tener roles de personal o instructor y de cliente. Agregar un rol de personal o instructor conserva el historial del cliente, sus créditos y su pertenencia familiar. El personal y los instructores pueden comprar productos de cafetería como clientes; su beneficio de asistencia gratuita a clases no hace gratuitas las compras de cafetería.
- Cuentas de desarrollo aprobadas: admin@conecta.example.test con rol de administrador y testuser@conecta.example.test con rol de cliente. Estas cuentas de prueba son exclusivas del entorno de desarrollo.
- La creación de clientes requiere un correo electrónico. El flujo habitual de creación por el personal envía una invitación para confirmar el correo y establecer una contraseña; no admite crear registros de clientes sin correo electrónico.
- Un administrador o gerente puede crear una cuenta sin exigir confirmación del correo electrónico. Es una excepción explícita al flujo de invitación, no un permiso para que el personal sin funciones administrativas o los instructores omitan la verificación.
- El primer administrador se crea manualmente en la base de datos y no requiere verificación del correo electrónico. Sigue siendo necesario un correo electrónico para iniciar sesión.
- Las contraseñas iniciales que coinciden con el nombre de la cuenta se aplican únicamente a cuentas de prueba del entorno de desarrollo: admin/admin y testuser/testuser. Esta regla no se aplica a cuentas normales, incluidas las creadas por un administrador o gerente; reciben un enlace seguro de un solo uso por correo electrónico para elegir su propia contraseña, incluso cuando están exentas de confirmar el correo. Deben establecer la contraseña antes de acceder a la cuenta; este paso no agrega un requisito separado de confirmación del correo.
- Solo los administradores o la gerencia pueden eliminar la cuenta de otro cliente; el personal no puede eliminar clientes.
- Los clientes pueden registrarse por su cuenta con confirmación de correo electrónico, actualizar sus propios datos personales y eliminar su propia cuenta.
- Solo los administradores o la gerencia pueden editar los datos personales de otro cliente. El personal sin funciones administrativas puede crear clientes, pero editar únicamente su propio perfil personal; el permiso para crear clientes no autoriza modificar posteriormente el perfil de ese cliente.
- Estos permisos sobre cuentas no amplían el acceso operativo a finanzas, créditos ni registros privados de otras personas.
- Eliminar a un cliente o instructor significa desactivar su acceso y conservar el historial de reservas, pagos y auditoría; no significa borrar físicamente esos registros.
- Desactivar la cuenta de un cliente cancela sus reservas futuras aplicando la regla habitual de cancelación de dos horas: con al menos dos horas de anticipación se libera el crédito apartado; con menos de dos horas se consume. Se conserva el historial de reservas, pagos y auditoría. Los créditos restantes sin usar se conservan registrados hasta su vencimiento habitual, sin reembolso automático ni renovación de vigencia. Los créditos del grupo familiar siguen las reglas de salida acordadas en la sección 5, incluida la elección del comprador de retirar los créditos que correspondan o dejarlos en el grupo. Al desactivar su propia cuenta, el cliente debe elegir explícitamente entre conservar sus créditos comprados que correspondan registrados en la cuenta inactiva o dejarlos con la familia; conservarlos no genera un reembolso y mantiene su vencimiento habitual. Si la administración desactiva la cuenta sin una elección del cliente, los créditos comprados que correspondan se conservan registrados en la cuenta inactiva, sin reembolso ni cambio de vencimiento; no se ceden a la familia. Los créditos apartados para reservas que siguen siendo válidas permanecen apartados. Al cerrar el grupo, los créditos restantes siguen la regla de devolución a sus compradores originales de la sección 5, incluidos los cedidos previamente. No se presupone una pérdida adicional ni una transferencia de saldo no autorizada. Si se desactiva un responsable pero queda otro responsable activo y autorizado, el perfil dependiente permanece activo y sus reservas siguen siendo válidas, incluidas las realizadas por quien se retira. Si también se desactiva el perfil dependiente, sus reservas futuras se cancelan aplicando la misma regla de dos horas y conservando el historial.

El resto de la matriz de permisos, las protecciones para cambios de roles privilegiados, la representación técnica de varios roles y las operaciones detalladas de gestión familiar se definirán en la especificación. Esta tabla no otorga acceso financiero ilimitado a todo el personal.

## 10. Cafetería

- La administración mantiene el catálogo, los precios y los paquetes o combos con descuento.
- Los paquetes de cafetería son descuentos sobre productos comprados juntos en una misma venta, no créditos prepagados para canjear en varias visitas.
- El personal registra ventas y pagos para contar con un historial financiero de la cafetería desde la primera versión.
- Solo los propietarios, administradores y gerentes pueden cambiar precios; el personal de cafetería puede realizar las operaciones de venta que tenga autorizadas.
- El inventario de ingredientes se agregará posteriormente.
- Los paquetes que combinen productos de cafetería y clases del estudio son una posibilidad futura, fuera de la primera versión.

## 11. Detalles por resolver durante la especificación

Estas preguntas no invalidan la intención confirmada y no deben resolverse de forma implícita durante la implementación:

- Contenido de la página pública de inicio, identidad visual, pantallas detalladas, gestión de medios y flujo de traducción.
- Selección del proveedor de correo de producción durante la planificación, tratamiento de obligaciones durante la desactivación de cuentas, permisos restantes sobre perfiles, operaciones detalladas de gestión familiar, permisos de responsables de perfiles dependientes. El registro de clientes por su cuenta y el flujo habitual de invitación de cuentas creadas por el personal requieren confirmación del correo; las cuentas creadas por administradores o gerentes y el primer administrador creado manualmente tienen las excepciones explícitas de la sección 9.1. La eliminación desactiva el acceso conservando el historial.
- Cálculo exacto de la vigencia de 30 días, zona horaria y horas de corte, y qué créditos se renuevan al comprar dentro de una familia, incluidos los ya reservados.
- Vencimiento de créditos restablecidos, excepciones por cancelación tardía y créditos liberados cuya fecha de vencimiento original ya pasó.
- Selección del proveedor, conexión de cuentas, confirmaciones y fallos de pago, reembolsos y conciliación financiera.
- Anticipación máxima para reservar, recurrencia de horarios, sustitución de instructores, sesiones canceladas por el estudio y si una sesión sin asistentes cuenta como realizada para efectos de nómina.
- Catálogo de paquetes, requisitos y límites de recompra del paquete de entrada/prueba, y distribución del precio de un paquete entre sus créditos cuando no se divide de forma exacta.
- Fechas de aplicación de cambios de porcentaje de instructores, redondeo, límites de los periodos de nómina y ajustes después de confirmar o pagar la nómina.
- Alcance del registro de gastos y reportes, y flujos de corrección o reembolso de ventas de cafetería.
- Despliegue, criterios de accesibilidad, indicadores numéricos de éxito y una posible migración desde el otro sistema de la propietaria.
