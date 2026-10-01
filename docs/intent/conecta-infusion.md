# Conecta Infusion: confirmed product intent

Status: confirmed by the user during the requirements interview.
Recorded: October 1, 2026 (America/Mexico_City).

This document and the [agreed business rules](../requirements/agreed-business-rules.md) record the interview outcome. They describe intended behavior, not implemented capabilities. They take precedence over tentative feature sequencing in the original scaffold's architecture notes. They are inputs to the specification, not a completed specification or implementation plan.

## Outcome and motivation

Build an efficient management and customer application for Conecta Infusion Yoga, a multidiscipline studio with a café. Disciplines include yoga, ballet, functional training, and K-pop; the product must not model every activity as yoga.

The owner is also configuring another management application. This project explores whether a better alternative can reduce daily administrative work; there is no fixed launch deadline or agreed switch-over date.

The clearest pain point is instructor payroll. Different instructors receive different percentages, and attendees use credits with different purchase values. Calculations currently rely on paper records, while payment confirmations are handled through WhatsApp. The app should calculate accurate amounts and keep a traceable record of payment and acknowledgment.

Brand reference supplied by the user: [Conecta Infusion Yoga on Instagram](https://www.instagram.com/conectainfusionyoga/). This is a reference for later discovery and design, not a source of additional confirmed requirements.

## Users

- Owners, admins, and managers oversee configuration, prices, finances, and payroll.
- Reception and café staff perform relevant daily operations and record payments.
- Instructors manage their assigned sessions and see their own earnings and payment history.
- Customers browse, purchase credits, book and cancel classes, and view relevant account history.
- Family members have individual logins and draw from a shared credit pool.

## First-release scope

- Management of disciplines, class descriptions, photos/videos, schedules, packages, and prices.
- Customer booking and cancellation in the first release, not deferred to a later phase.
- Single-class purchases, discounted class packages, shared family credits, expiration and renewal, and audited staff adjustments.
- Attendance, session completion, instructor earnings, twice-monthly payroll, external-payment recording, and instructor acknowledgment.
- Café catalog, prices, same-sale discounted combos, sales, and payment records.
- Separate studio and café finances and separately configurable payment accounts, even if both initially use the same account.
- One online payment provider initially, plus recording payments made in person. Mercado Pago Checkout Pro was recommended; final provider selection and account setup remain for specification.
- Role-appropriate visibility, permissions, and audit history.
- Spanish as the primary language and English supported from the start.
- A public home page and responsive phone/computer layouts, to be defined during specification and design.

## Constraints and success

The first release serves Conecta Infusion only, operating in Mexico and charging MXN. Country/currency should be configurable in settings with future reuse in mind, but multi-country payments and operation are not promised merely by changing a setting.

The technical starting point is a React web app, Node.js backend, and PostgreSQL. Future mobile use is a goal; a native mobile release has not been committed to for the first release.

Success means less administrative work, correct instructor pay across mixed-price credits, and a clear history of credits, attendance, payments, adjustments, and acknowledgments. Numerical success targets and evaluation against the owner's other application have not yet been defined.

## Outside the first release

- Ingredient inventory.
- Waitlists.
- Packages combining studio and café offerings.
- Hosting multiple independent studio businesses.
- Automated transfers to instructors; there is no commitment to add these later.
- A shared time-slot demand view: tracked in [GitHub issue #1](https://github.com/LFGJ-personal/ConectaInfusionApp/issues/1).

## Next step

Write a specification covering the public home page, screen flows, responsive design, bilingual behavior, data and payment lifecycles, and the open details listed with the agreed business rules. Do not silently turn open questions or recommendations into approved rules.
