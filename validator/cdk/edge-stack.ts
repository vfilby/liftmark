import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface LmwfEdgeStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
}

/**
 * CloudFront requires its ACM certificate in us-east-1. This stack lives there
 * and only exists to create that certificate. The main stack, which runs in
 * its own region, references this cert via CDK cross-region references.
 */
export class LmwfEdgeStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: LmwfEdgeStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'LiftMarkZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: 'liftmark.app',
    });

    this.certificate = new acm.Certificate(this, 'CloudFrontCert', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
