import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Organization,
  OrganizationalUnit,
  Account,
} from "@pepperize/cdk-organizations";

export interface OrgStackProps extends StackProps {
  devEmail: string;
  stageEmail: string;
  prodEmail: string;
}

export class OrgStack extends Stack {
  constructor(scope: Construct, id: string, props: OrgStackProps) {
    super(scope, id, props);

    const org = new Organization(this, "Org");

    const nonProd = new OrganizationalUnit(this, "NonProdOu", {
      organizationalUnitName: "nonprod",
      parent: org.root,
    });

    const prod = new OrganizationalUnit(this, "ProdOu", {
      organizationalUnitName: "prod",
      parent: org.root,
    });

    const dev = new Account(this, "DevAccount", {
      accountName: "dev",
      email: props.devEmail,
      parent: nonProd,
    });

    const stage = new Account(this, "StageAccount", {
      accountName: "stage",
      email: props.stageEmail,
      parent: nonProd,
    });

    const prodAccount = new Account(this, "ProdAccount", {
      accountName: "prod",
      email: props.prodEmail,
      parent: prod,
    });

    new CfnOutput(this, "DevAccountId", {
      value: dev.accountId,
      description: "Dev Account ID",
      exportName: "DevAccountId",
    });

    new CfnOutput(this, "StageAccountId", {
      value: stage.accountId,
      description: "Stage Account ID",
      exportName: "StageAccountId",
    });

    new CfnOutput(this, "ProdAccountId", {
      value: prodAccount.accountId,
      description: "Prod Account ID",
      exportName: "ProdAccountId",
    });
  }
}
