import { Router, type IRouter } from "express";
import healthRouter from "./health";
import northCreekRouter from "./north-creek";

const router: IRouter = Router();

router.use(healthRouter);
router.use(northCreekRouter);

export default router;
