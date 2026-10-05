import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { homeService } from "../services/home.service";

export const homeController = {
  getHome: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await homeService.getHome(req.user?.userId));
  }),

  getDivinePicks: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await homeService.getSection("todays_divine_picks", req.user?.userId));
  }),

  getTrending: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await homeService.getSection("trending", req.user?.userId));
  }),
};
