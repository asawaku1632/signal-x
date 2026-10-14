import {notFound} from "next/navigation";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import BollingerBreakoutClient from "./BollingerBreakoutClient";
export const dynamic="force-dynamic";
export default async function Page(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  return <BollingerBreakoutClient/>;
}
