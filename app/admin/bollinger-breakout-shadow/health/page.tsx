import {notFound} from "next/navigation";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import Stage7HealthClient from "./Stage7HealthClient";

export const dynamic="force-dynamic";
export default async function Page(){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)notFound();
 return <Stage7HealthClient/>;
}
