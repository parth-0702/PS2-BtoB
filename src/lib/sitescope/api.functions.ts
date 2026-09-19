import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildCityData, listCities } from "./mock-data";
import { resolveAnswers } from "./resolve";
import type { Answers } from "./types";

/** GET /cities — includes a coverage summary per layer. */
export const getCities = createServerFn({ method: "GET" }).handler(async () => listCities());

/** GET /cities/:id/data — synthetic hex grid for the chosen city. */
export const getCityData = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ cityId: z.string() }).parse(input))
  .handler(async ({ data }) => buildCityData(data.cityId));

const AnswerSchema = z.object({
  optionIds: z.array(z.string()).default([]),
  customText: z.string().max(400).optional(),
});

/** POST /questionnaire/resolve — answers in, ScoringConfig + interpretation out. */
export const resolveQuestionnaire = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ city: z.string(), answers: z.record(z.string(), AnswerSchema) }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = resolveAnswers(data.answers as Answers);
    return { city: data.city, ...result };
  });
