<?php
/**
 * Plugin Name: Elementor MCP Bridge
 * Description: REST endpoints to create/read/edit Elementor pages programmatically (used by the Elementor MCP server).
 * Version: 0.1.0
 * Author: MCP Bridge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const XMCP_NS = 'xmcp/v1';

/**
 * Local-dev convenience: WordPress only allows Application Passwords over HTTPS by default.
 * LocalWP/MAMP sites usually run on plain HTTP, so enable them here.
 * Safe for local development — remove (or guard) on a public production site.
 */
add_filter( 'wp_is_application_passwords_available', '__return_true' );

add_action( 'rest_api_init', function () {
	register_rest_route( XMCP_NS, '/page', [
		'methods'             => 'POST',
		'callback'            => 'xmcp_create_page',
		'permission_callback' => 'xmcp_permission',
	] );

	register_rest_route( XMCP_NS, '/page/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'xmcp_get_page',
		'permission_callback' => 'xmcp_permission',
	] );

	register_rest_route( XMCP_NS, '/element', [
		'methods'             => 'PATCH',
		'callback'            => 'xmcp_update_element',
		'permission_callback' => 'xmcp_permission',
	] );
} );

/**
 * Only users who can edit pages may use the bridge. With an Application Password,
 * WordPress authenticates the request as that user automatically.
 */
function xmcp_permission() {
	return current_user_can( 'edit_pages' );
}

function xmcp_elementor_ready() {
	return did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' );
}

/**
 * Save Elementor elements onto a post through the document API so that the
 * `_elementor_data` meta, version meta and per-post CSS are all written correctly.
 */
function xmcp_save_elements( $page_id, $elements ) {
	update_post_meta( $page_id, '_elementor_edit_mode', 'builder' );

	$document = \Elementor\Plugin::$instance->documents->get( $page_id );
	if ( ! $document ) {
		return new WP_Error( 'no_doc', 'Could not load Elementor document', [ 'status' => 500 ] );
	}

	$document->save( [ 'elements' => $elements ] );

	// Belt-and-suspenders CSS regeneration (document->save already does this on most versions).
	if ( class_exists( '\Elementor\Core\Files\CSS\Post' ) ) {
		$css = \Elementor\Core\Files\CSS\Post::create( $page_id );
		$css->update();
	}

	return true;
}

function xmcp_create_page( WP_REST_Request $req ) {
	if ( ! xmcp_elementor_ready() ) {
		return new WP_Error( 'no_elementor', 'Elementor is not active on this site', [ 'status' => 500 ] );
	}

	$params   = $req->get_json_params();
	$title    = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : 'Untitled';
	$status   = isset( $params['status'] ) && in_array( $params['status'], [ 'publish', 'draft' ], true ) ? $params['status'] : 'draft';
	$elements = isset( $params['elements'] ) && is_array( $params['elements'] ) ? $params['elements'] : [];
	$page_id  = isset( $params['page_id'] ) ? intval( $params['page_id'] ) : 0;
	$template = isset( $params['template'] ) ? sanitize_text_field( $params['template'] ) : '';

	if ( $page_id ) {
		wp_update_post( [
			'ID'          => $page_id,
			'post_title'  => $title,
			'post_status' => $status,
		] );
	} else {
		$page_id = wp_insert_post( [
			'post_title'  => $title,
			'post_status' => $status,
			'post_type'   => 'page',
		] );
	}

	if ( is_wp_error( $page_id ) || ! $page_id ) {
		return new WP_Error( 'insert_failed', 'Could not create the page', [ 'status' => 500 ] );
	}

	// Optional full-width canvas template (no theme header/footer).
	if ( $template ) {
		update_post_meta( $page_id, '_wp_page_template', $template );
	}

	$saved = xmcp_save_elements( $page_id, $elements );
	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	return [
		'success'  => true,
		'page_id'  => $page_id,
		'edit_url' => admin_url( 'post.php?post=' . $page_id . '&action=elementor' ),
		'view_url' => get_permalink( $page_id ),
	];
}

function xmcp_get_page( WP_REST_Request $req ) {
	$id   = intval( $req['id'] );
	$data = get_post_meta( $id, '_elementor_data', true );
	$decoded = is_string( $data ) ? json_decode( $data, true ) : $data;

	return [
		'page_id'  => $id,
		'title'    => get_the_title( $id ),
		'elements' => $decoded ? $decoded : [],
	];
}

function xmcp_update_element( WP_REST_Request $req ) {
	if ( ! xmcp_elementor_ready() ) {
		return new WP_Error( 'no_elementor', 'Elementor is not active on this site', [ 'status' => 500 ] );
	}

	$params     = $req->get_json_params();
	$page_id    = intval( $params['page_id'] );
	$element_id = isset( $params['element_id'] ) ? sanitize_text_field( $params['element_id'] ) : '';
	$settings   = isset( $params['settings'] ) && is_array( $params['settings'] ) ? $params['settings'] : [];

	if ( ! $page_id || ! $element_id ) {
		return new WP_Error( 'bad_request', 'page_id and element_id are required', [ 'status' => 400 ] );
	}

	$data     = get_post_meta( $page_id, '_elementor_data', true );
	$elements = is_string( $data ) ? json_decode( $data, true ) : $data;
	if ( ! is_array( $elements ) ) {
		return new WP_Error( 'no_data', 'No Elementor data on this page', [ 'status' => 404 ] );
	}

	$found = false;
	$walk  = function ( &$nodes ) use ( &$walk, $element_id, $settings, &$found ) {
		foreach ( $nodes as &$node ) {
			if ( isset( $node['id'] ) && $node['id'] === $element_id ) {
				$existing         = isset( $node['settings'] ) && is_array( $node['settings'] ) ? $node['settings'] : [];
				$node['settings'] = array_merge( $existing, $settings );
				$found            = true;
			}
			if ( ! empty( $node['elements'] ) ) {
				$walk( $node['elements'] );
			}
		}
	};
	$walk( $elements );

	if ( ! $found ) {
		return new WP_Error( 'not_found', 'Element id not found on this page', [ 'status' => 404 ] );
	}

	$saved = xmcp_save_elements( $page_id, $elements );
	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	return [
		'success'    => true,
		'page_id'    => $page_id,
		'element_id' => $element_id,
	];
}
